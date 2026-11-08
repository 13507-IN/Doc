const Item = require('../models/Item');
const { cloudinary, configured: cloudinaryConfigured } = require('../config/cloudinary');
const { enqueueItemOcr, recognize, extractUrlsFromText } = require('../services/ocrService');
const { isVisionHtrAvailable, transcribeImageWithVision } = require('../services/visionHtrService');
const { invalidateAssistantCache } = require('./assistantController');
const PendingUpload = require('../models/PendingUpload');
const axios = require('axios');
const { serializeItem } = require('../services/itemSerializer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const uploadsDir = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true, mode: 0o700 });
try {
  fs.chmodSync(uploadsDir, 0o700);
  for (const entry of fs.readdirSync(uploadsDir, { withFileTypes: true })) {
    if (entry.isFile()) fs.chmodSync(path.join(uploadsDir, entry.name), 0o600);
  }
} catch (error) {
  console.warn('[Uploads] Could not apply private filesystem permissions:', error.message);
}

const DEFAULT_PAGE_SIZE = 30;
const MAX_PAGE_SIZE = 100;

async function storeImage(req) {
  let cloudinaryPublicId = null;
  let cloudinaryFormat = '';
  let localFilename = null;
  let storage = 'local';
  let storageWarning = '';

  if (cloudinaryConfigured) {
    try {
      const result = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new Error('Cloudinary upload timed out after 8 seconds'));
        }, 8000);

        const stream = cloudinary.uploader.upload_stream(
          {
            folder: `holder/${req.user.id}`,
            resource_type: 'image',
            type: 'authenticated',
            allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
            transformation: [{ width: 2400, height: 2400, crop: 'limit' }]
          },
          (error, uploadResult) => {
            clearTimeout(timer);
            if (error) reject(error);
            else resolve(uploadResult);
          }
        );
        stream.on('error', (err) => {
          clearTimeout(timer);
          reject(err);
        });
        stream.end(req.file.buffer);
      });
      cloudinaryPublicId = result.public_id;
      cloudinaryFormat = result.format || '';
      storage = 'cloudinary';
    } catch (error) {
      console.error('[Cloudinary] Image upload failed; falling back to local storage:', error.message);
      if (error.message?.includes('missing permissions') || error.message?.includes('actions=["create"]')) {
        storageWarning = 'Cloudinary API key is missing "create" permissions. Saved on server disk.';
      } else if (error.message?.includes('timed out')) {
        storageWarning = 'Cloudinary upload timed out. Saved on server disk.';
      } else {
        storageWarning = 'Cloudinary upload failed. Saved on server disk.';
      }
    }
  }

  if (!cloudinaryPublicId) {
    const ext = path.extname(req.file.originalname) || '.png';
    const cleanBase = path.basename(req.file.originalname, ext).replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 40) || 'img';
    localFilename = `img-${cleanBase}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`;
    await fs.promises.writeFile(path.join(uploadsDir, localFilename), req.file.buffer, { mode: 0o600 });
  }

  return {
    cloudinaryPublicId,
    cloudinaryFormat,
    localFilename,
    storage,
    storageWarning: storageWarning || (storage === 'local'
      ? 'Cloudinary is unavailable, so this image is stored on the server disk.'
      : '')
  };
}

function mediaFields(stored, file) {
  return {
    mediaStorage: stored.storage,
    mediaMimeType: file.mimetype,
    cloudinaryPublicId: stored.cloudinaryPublicId,
    cloudinaryType: stored.cloudinaryPublicId ? 'authenticated' : null,
    cloudinaryResourceType: stored.cloudinaryPublicId ? 'image' : null,
    cloudinaryFormat: stored.cloudinaryFormat || '',
    localFilename: stored.localFilename
  };
}

function clientSafeMetadata(metadata = {}) {
  const safe = metadata && typeof metadata === 'object' && !Array.isArray(metadata)
    ? { ...metadata }
    : {};
  for (const key of [
    'cloudinaryPublicId',
    'cloudinaryType',
    'cloudinaryResourceType',
    'cloudinaryFormat',
    'localFilename',
    'mediaStorage',
    'mediaMimeType',
    'uploadId'
  ]) {
    delete safe[key];
  }
  return safe;
}

async function createPendingUpload(userId, file, stored, resourceType) {
  const pending = await PendingUpload.create({
    userId,
    storage: stored.storage,
    localFilename: stored.localFilename || null,
    cloudinaryPublicId: stored.cloudinaryPublicId || null,
    cloudinaryResourceType: resourceType,
    cloudinaryFormat: stored.cloudinaryFormat || '',
    mimeType: file.mimetype,
    filename: file.originalname || (resourceType === 'raw' ? 'document.pdf' : 'image'),
    size: file.size,
    expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000)
  });
  return pending;
}

async function deletePendingUploadById(uploadId, userId) {
  if (!/^[a-f\d]{24}$/i.test(String(uploadId || ''))) return false;
  const pending = await PendingUpload.findOneAndDelete({ _id: uploadId, userId });
  if (!pending) return false;
  await discardStoredMedia(pending);
  return true;
}

function setPrivateMediaHeaders(res, mimeType, filename) {
  const safeName = String(filename || 'file')
    .replace(/[\r\n"]/g, '_')
    .replace(/[^\x20-\x7E]/g, '_')
    .slice(0, 150) || 'file';
  res.set({
    'Content-Type': mimeType,
    'Content-Disposition': `inline; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(filename || 'file')}`,
    'Cache-Control': 'private, no-store, max-age=0',
    Pragma: 'no-cache',
    'X-Content-Type-Options': 'nosniff',
    'Cross-Origin-Resource-Policy': 'cross-origin'
  });
}

async function streamStoredMedia(res, media, resourceType, fallbackMimeType) {
  const mimeType = media.mediaMimeType || media.mimeType || fallbackMimeType;
  const filename = media.filename || media.originalFilename || 'file';

  setPrivateMediaHeaders(res, mimeType, filename);

  if (media.localFilename) {
    if (path.basename(media.localFilename) !== media.localFilename) {
      return res.status(404).end();
    }
    const filePath = path.join(uploadsDir, media.localFilename);
    try {
      await fs.promises.access(filePath, fs.constants.R_OK);
    } catch {
      return res.status(404).end();
    }
    return fs.createReadStream(filePath)
      .on('error', () => {
        if (!res.headersSent) res.status(404);
        res.end();
      })
      .pipe(res);
  }

  if (!media.cloudinaryPublicId || !cloudinaryConfigured) {
    return res.status(404).end();
  }

  let downloadUrl;
  const deliveryType = media.cloudinaryType || 'upload';
  if (deliveryType === 'authenticated' || deliveryType === 'private') {
    const format = media.cloudinaryFormat || (resourceType === 'raw' ? 'pdf' : undefined);
    downloadUrl = cloudinary.utils.private_download_url(
      media.cloudinaryPublicId,
      format,
      {
        resource_type: resourceType,
        type: deliveryType,
        expires_at: Math.floor(Date.now() / 1000) + 60
      }
    );
  } else {
    // Legacy public assets are proxied without exposing their Cloudinary URL.
    // Run the migration command to change their delivery type to authenticated.
    downloadUrl = cloudinary.url(media.cloudinaryPublicId, {
      secure: true,
      resource_type: resourceType,
      type: 'upload',
      format: media.cloudinaryFormat || undefined
    });
  }

  try {
    const response = await axios.get(downloadUrl, {
      responseType: 'stream',
      timeout: 20000,
      maxRedirects: 3
    });
    return response.data
      .on('error', () => {
        if (!res.headersSent) res.status(502);
        res.end();
      })
      .pipe(res);
  } catch (error) {
    console.error('[Media] Private asset retrieval failed:', error.message);
    if (!res.headersSent) res.status(502).end();
    return undefined;
  }
}

async function discardStoredMedia(media = {}) {
  if (media.cloudinaryPublicId && cloudinaryConfigured) {
    const resourceType = media.cloudinaryResourceType || 'image';
    const type = media.cloudinaryType || 'upload';
    await cloudinary.uploader.destroy(media.cloudinaryPublicId, {
      resource_type: resourceType,
      type,
      invalidate: true
    }).catch((error) => {
      console.warn('[Cloudinary] Unable to remove stored media:', error.message);
    });
  }
  if (media.localFilename && path.basename(media.localFilename) === media.localFilename) {
    await fs.promises.unlink(path.join(uploadsDir, media.localFilename)).catch(() => {});
  }
}

exports.cleanupExpiredUploads = async () => {
  const expired = await PendingUpload.find({ expiresAt: { $lte: new Date() } }).limit(100).lean();
  for (const upload of expired) {
    await discardStoredMedia(upload);
    await PendingUpload.deleteOne({ _id: upload._id });
  }
  return expired.length;
};

function decodeCursor(cursor) {
  try {
    const decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (
      typeof decoded.pinned !== 'boolean' ||
      !decoded.createdAt ||
      !decoded.id
    ) {
      return null;
    }
    return { ...decoded, createdAt: new Date(decoded.createdAt) };
  } catch {
    return null;
  }
}

function encodeCursor(item) {
  return Buffer.from(JSON.stringify({
    pinned: item.pinned,
    createdAt: item.createdAt,
    id: item._id.toString()
  })).toString('base64url');
}

// Get items scoped to authenticated user
exports.getItems = async (req, res) => {
  try {
    const userId = req.user.id;
    const { folderId, type, search, isFavorite, tag, cursor } = req.query;
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);

    const query = { userId };

    if (folderId !== undefined) {
      if (folderId === 'uncategorized' || folderId === 'null') {
        query.folderId = null;
      } else if (folderId !== 'all') {
        query.folderId = folderId;
      }
    }

    if (type && type !== 'all') {
      query.type = type;
    }

    if (isFavorite === 'true') {
      query.isFavorite = true;
    }

    if (tag) {
      query.tags = tag;
    }

    if (search?.trim()) {
      query.$text = { $search: search.trim() };
    }

    const decodedCursor = cursor ? decodeCursor(cursor) : null;
    if (cursor && !decodedCursor) {
      return res.status(400).json({ success: false, message: 'Invalid pagination cursor' });
    }
    if (decodedCursor) {
      query.$and = [{
        $or: [
          { pinned: { $lt: decodedCursor.pinned } },
          { pinned: decodedCursor.pinned, createdAt: { $lt: decodedCursor.createdAt } },
          { pinned: decodedCursor.pinned, createdAt: decodedCursor.createdAt, _id: { $lt: decodedCursor.id } }
        ]
      }];
    }

    const items = await Item.find(query)
      .populate('folderId', 'name icon color')
      .sort({ pinned: -1, createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .lean();
    const hasMore = items.length > limit;
    const pageItems = hasMore ? items.slice(0, limit) : items;

    res.json({
      success: true,
      count: pageItems.length,
      items: pageItems.map(serializeItem),
      page: {
        hasMore,
        nextCursor: hasMore ? encodeCursor(pageItems.at(-1)) : null
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get single item by ID
exports.getItemById = async (req, res) => {
  try {
    const userId = req.user.id;
    const item = await Item.findOne({ _id: req.params.id, userId }).populate('folderId', 'name icon color');
    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }
    res.json({ success: true, item: serializeItem(item) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getItemMedia = async (req, res) => {
  try {
    const item = await Item.findOne({ _id: req.params.id, userId: req.user.id })
      .select('type metadata');
    if (!item) return res.status(404).end();

    const metadata = item.metadata || {};
    const resourceType = metadata.cloudinaryResourceType ||
      (item.type === 'pdf' || item.type === 'document' ? 'raw' : 'image');
    const fallbackMimeType = resourceType === 'raw' ? 'application/pdf' : 'application/octet-stream';
    if (!metadata.localFilename && !metadata.cloudinaryPublicId) {
      return res.status(404).end();
    }
    return await streamStoredMedia(res, {
      ...metadata,
      filename: metadata.filename || (resourceType === 'raw' ? 'document.pdf' : 'image')
    }, resourceType, fallbackMimeType);
  } catch (error) {
    if (error.name === 'CastError') return res.status(404).end();
    console.error('[Media] Item media request failed:', error.message);
    return res.status(500).end();
  }
};

exports.getPendingUploadMedia = async (req, res) => {
  try {
    const pending = await PendingUpload.findOne({
      _id: req.params.id,
      userId: req.user.id,
      expiresAt: { $gt: new Date() }
    }).lean();
    if (!pending) return res.status(404).end();
    return await streamStoredMedia(
      res,
      pending,
      pending.cloudinaryResourceType,
      pending.mimeType
    );
  } catch (error) {
    if (error.name === 'CastError') return res.status(404).end();
    console.error('[Media] Pending upload preview failed:', error.message);
    return res.status(500).end();
  }
};

exports.deletePendingUpload = async (req, res) => {
  try {
    const deleted = await deletePendingUploadById(req.params.id, req.user.id);
    if (!deleted) return res.status(404).json({ success: false, message: 'Upload not found.' });
    return res.status(204).end();
  } catch (error) {
    console.error('[Uploads] Pending upload cleanup failed:', error.message);
    return res.status(500).json({ success: false, message: 'Could not remove the staged upload.' });
  }
};

// Create a new item scoped to user
exports.createItem = async (req, res) => {
  let consumedUpload = null;
  try {
    const userId = req.user.id;
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const {
      title, type, folderId, url, content, previewUrl, ocrText, tags, metadata,
      isFavorite, isPrivate, pinned, expiresAt, reminderDays, uploadId
    } = body;

    if (!title || !type) {
      return res.status(400).json({ success: false, message: 'Title and type are required' });
    }

    const uploadedResourceType = type === 'pdf' || type === 'document' ? 'raw' : 'image';
    let pendingUpload = null;
    if (uploadId) {
      if (!/^[a-f\d]{24}$/i.test(String(uploadId))) {
        return res.status(400).json({ success: false, message: 'The uploaded file is invalid or expired. Upload it again.' });
      }
      pendingUpload = await PendingUpload.findOneAndDelete({
        _id: uploadId,
        userId,
        cloudinaryResourceType: uploadedResourceType,
        expiresAt: { $gt: new Date() }
      });
      if (!pendingUpload) {
        return res.status(400).json({ success: false, message: 'The uploaded file is invalid or expired. Upload it again.' });
      }
      consumedUpload = pendingUpload;
    }

    // Check for existing duplicate URL for this user (unless allowDuplicate is explicitly true)
    if (url && url.trim() && !pendingUpload && !body.allowDuplicate) {
      const normalizedUrl = url.trim().replace(/\/$/, '');
      const existing = await Item.findOne({ 
        userId, 
        url: { $regex: `^${normalizedUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/?$`, $options: 'i' } 
      }).populate('folderId', 'name icon color');

      if (existing) {
        const folderName = existing.folderId?.name || 'Uncategorized';
        const savedDate = new Date(existing.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
        return res.status(409).json({
          success: false,
          isDuplicate: true,
          message: `Already in your vault in "${folderName}" (saved on ${savedDate})`,
          existingItem: serializeItem(existing)
        });
      }
    }

    const processedTags = Array.isArray(tags) 
      ? tags.map(t => t.trim()).filter(Boolean)
      : (typeof tags === 'string' ? tags.split(',').map(t => t.trim()).filter(Boolean) : []);

    const cleanMetadata = clientSafeMetadata(metadata);
    if (pendingUpload) {
      Object.assign(cleanMetadata, {
        filename: pendingUpload.filename,
        size: pendingUpload.size,
        mediaStorage: pendingUpload.storage,
        mediaMimeType: pendingUpload.mimeType,
        cloudinaryPublicId: pendingUpload.cloudinaryPublicId,
        cloudinaryType: pendingUpload.cloudinaryPublicId ? 'authenticated' : null,
        cloudinaryResourceType: pendingUpload.cloudinaryResourceType,
        cloudinaryFormat: pendingUpload.cloudinaryFormat || '',
        localFilename: pendingUpload.localFilename
      });
    }
    const storedFields = pendingUpload
      ? {
          mediaStorage: pendingUpload.storage,
          mediaMimeType: pendingUpload.mimeType,
          cloudinaryPublicId: pendingUpload.cloudinaryPublicId,
          cloudinaryType: pendingUpload.cloudinaryPublicId ? 'authenticated' : null,
          cloudinaryResourceType: pendingUpload.cloudinaryResourceType,
          cloudinaryFormat: pendingUpload.cloudinaryFormat || '',
          localFilename: pendingUpload.localFilename
        }
      : {};
    const isUploadedPdf = Boolean(pendingUpload && uploadedResourceType === 'raw');

    const item = new Item({
      userId,
      title,
      type,
      folderId: folderId || null,
      url: isUploadedPdf ? '' : (url || ''),
      content: content || '',
      ocrText: ocrText || '',
      previewUrl: pendingUpload ? '' : (previewUrl || ''),
      tags: processedTags,
      metadata: {
        ...cleanMetadata,
        ...(pendingUpload ? {
          filename: pendingUpload.filename,
          size: pendingUpload.size
        } : {}),
        ...storedFields
      },
      isFavorite: Boolean(isFavorite),
      isPrivate: Boolean(isPrivate),
      pinned: Boolean(pinned),
      expiresAt: expiresAt || null,
      reminderDays: Number.isFinite(Number(reminderDays)) ? Number(reminderDays) : 30
    });

    try {
      await item.save();
    } catch (error) {
      throw error;
    }
    // Ownership transferred to the saved item; later response/population errors
    // must never remove media that the item now references.
    consumedUpload = null;
    invalidateAssistantCache(userId);
    const populatedItem = await Item.findById(item._id).populate('folderId', 'name icon color');

    // If item was created from an uploaded image, enqueue background OCR for deep transcription (including handwriting Vision HTR)
    if (pendingUpload && pendingUpload.cloudinaryResourceType === 'image') {
      getItemImageBuffer(item)
        .then((buf) => enqueueItemOcr(item._id, buf, { mimeType: pendingUpload.mimeType || 'image/jpeg' }))
        .catch((err) => console.warn('[OCR] Background OCR enqueue deferred:', err.message));
    }

    res.status(201).json({ success: true, item: serializeItem(populatedItem) });
  } catch (error) {
    if (consumedUpload) await discardStoredMedia(consumedUpload);
    console.error('[Items] Item creation failed:', error.message);
    res.status(500).json({ success: false, message: 'Could not save this item. Please try again.' });
  }
};

// Update existing item
exports.updateItem = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const updateData = { ...req.body };
    const uploadId = updateData.uploadId;
    const removeMedia = updateData.removeMedia === true;
    delete updateData.uploadId;
    delete updateData.removeMedia;

    if (updateData.tags && typeof updateData.tags === 'string') {
      updateData.tags = updateData.tags.split(',').map(t => t.trim()).filter(Boolean);
    }

    if (updateData.folderId === '' || updateData.folderId === 'null') {
      updateData.folderId = null;
    }
    updateData.updatedAt = new Date();

    const existingItem = await Item.findOne({ _id: id, userId });
    if (!existingItem) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    const oldMetadata = existingItem.metadata?.toObject
      ? existingItem.metadata.toObject()
      : { ...(existingItem.metadata || {}) };
    const expectedResourceType = (updateData.type || existingItem.type) === 'pdf' ||
      (updateData.type || existingItem.type) === 'document' ? 'raw' : 'image';
    let pendingUpload = null;

    if (uploadId) {
      if (!/^[a-f\d]{24}$/i.test(String(uploadId))) {
        return res.status(400).json({ success: false, message: 'The uploaded file is invalid or expired. Upload it again.' });
      }
      pendingUpload = await PendingUpload.findOneAndDelete({
        _id: uploadId,
        userId,
        cloudinaryResourceType: expectedResourceType,
        expiresAt: { $gt: new Date() }
      });
      if (!pendingUpload) {
        return res.status(400).json({ success: false, message: 'The uploaded file is invalid or expired. Upload it again.' });
      }
    }

    let nextMetadata = {
      ...oldMetadata,
      ...clientSafeMetadata(updateData.metadata)
    };
    if (removeMedia || pendingUpload) {
      for (const key of [
        'cloudinaryPublicId',
        'cloudinaryType',
        'cloudinaryResourceType',
        'cloudinaryFormat',
        'localFilename',
        'mediaStorage',
        'mediaMimeType'
      ]) {
        delete nextMetadata[key];
      }
    }
    if (pendingUpload) {
      nextMetadata = {
        ...nextMetadata,
        filename: pendingUpload.filename,
        size: pendingUpload.size,
        mediaStorage: pendingUpload.storage,
        mediaMimeType: pendingUpload.mimeType,
        cloudinaryPublicId: pendingUpload.cloudinaryPublicId,
        cloudinaryType: pendingUpload.cloudinaryPublicId ? 'authenticated' : null,
        cloudinaryResourceType: pendingUpload.cloudinaryResourceType,
        cloudinaryFormat: pendingUpload.cloudinaryFormat || '',
        localFilename: pendingUpload.localFilename
      };
      updateData.previewUrl = '';
      if (expectedResourceType === 'raw') updateData.url = '';
    }
    updateData.metadata = nextMetadata;

    const replacedMedia = Boolean(removeMedia || pendingUpload);
    let item;
    try {
      item = await Item.findOneAndUpdate(
        { _id: id, userId },
        updateData,
        { new: true, runValidators: true }
      );
    } catch (error) {
      if (pendingUpload) await discardStoredMedia(pendingUpload);
      throw error;
    }
    if (!item) {
      if (pendingUpload) await discardStoredMedia(pendingUpload);
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    // The update committed, so the newly staged file belongs to the item now.
    pendingUpload = null;
    if (replacedMedia) {
      await discardStoredMedia(oldMetadata);
    }

    invalidateAssistantCache(userId);
    await item.populate('folderId', 'name icon color');
    res.json({ success: true, item: serializeItem(item) });
  } catch (error) {
    console.error('[Items] Item update failed:', error.message);
    res.status(500).json({ success: false, message: 'Could not update this item. Please try again.' });
  }
};

// Toggle favorite
exports.toggleFavorite = async (req, res) => {
  try {
    const userId = req.user.id;
    const item = await Item.findOneAndUpdate(
      { _id: req.params.id, userId },
      [{ $set: { isFavorite: { $not: '$isFavorite' }, updatedAt: '$$NOW' } }],
      { new: true }
    );
    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }
    res.json({ success: true, item: serializeItem(item) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Toggle pin
exports.togglePin = async (req, res) => {
  try {
    const userId = req.user.id;
    const item = await Item.findOneAndUpdate(
      { _id: req.params.id, userId },
      [{ $set: { pinned: { $not: '$pinned' }, updatedAt: '$$NOW' } }],
      { new: true }
    );
    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }
    res.json({ success: true, item: serializeItem(item) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete item
exports.deleteItem = async (req, res) => {
  try {
    const userId = req.user.id;
    const item = await Item.findOneAndDelete({ _id: req.params.id, userId });
    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }
    await discardStoredMedia(item.metadata || {});
    invalidateAssistantCache(userId);
    res.json({ success: true, message: 'Item deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Handle image upload with Cloudinary and local disk fallback (concurrent store + OCR)
exports.uploadImage = async (req, res) => {
  let stored;
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image file uploaded' });
    }

    const shouldOcr = req.query.ocr === 'true';
    const [storedImage, ocrResult] = await Promise.all([
      storeImage(req),
      shouldOcr
        ? recognize(req.file.buffer, { skipFallback: true }).catch((ocrErr) => {
            console.error('[OCR] Fast staging OCR processing failed:', ocrErr.message);
            return '';
          })
        : Promise.resolve('')
    ]);
    stored = storedImage;
    const pending = await createPendingUpload(req.user.id, req.file, storedImage, 'image');

    const ocrText = String(ocrResult?.text || ocrResult || '').trim();

    res.json({
      success: true,
      uploadId: pending._id,
      mediaUrl: `/api/uploads/${pending._id}/media`,
      filename: req.file.originalname,
      storage: storedImage.storage,
      storageWarning: storedImage.storageWarning,
      ocrText,
      ocrStatus: ocrText ? 'done' : 'none'
    });
  } catch (error) {
    if (stored) await discardStoredMedia({ ...stored, cloudinaryResourceType: 'image' });
    res.status(500).json({ success: false, message: error.message });
  }
};

// Save a screenshot immediately, then read its text in the background.
exports.createScreenshot = async (req, res) => {
  let stored;
  let itemCreated = false;
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No screenshot uploaded' });
    }

    stored = await storeImage(req);
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const userTags = String(body.tags || '')
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);

    const rawFolderId = body.folderId;
    const cleanFolderId = (rawFolderId && rawFolderId !== 'null' && rawFolderId !== 'undefined' && String(rawFolderId).trim() !== '')
      ? rawFolderId
      : null;

    const item = await Item.create({
      userId: req.user.id,
      title: String(body.title || `Screenshot — ${new Date().toLocaleString()}`).slice(0, 200),
      type: 'image',
      folderId: cleanFolderId,
      url: body.url || '',
      content: body.content || '',
      previewUrl: '',
      tags: [...new Set(['screenshot', 'quick-clip', ...userTags])],
      metadata: {
        ...clientSafeMetadata(body.metadata),
        size: req.file.size,
        mimeType: req.file.mimetype,
        filename: req.file.originalname || 'screenshot',
        ...mediaFields(stored, req.file)
      },
      ocrStatus: 'pending'
    });
    itemCreated = true;

    invalidateAssistantCache(req.user.id);

    res.status(201).json({
      success: true,
      item: serializeItem(item),
      storage: stored.storage,
      storageWarning: stored.storageWarning,
      message: 'Screenshot saved. Text is being read in the background.'
    });

    enqueueItemOcr(item._id, req.file.buffer, { mimeType: req.file?.mimetype || 'image/jpeg' });
  } catch (error) {
    if (stored && !itemCreated) {
      await discardStoredMedia({ ...stored, cloudinaryResourceType: 'image' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// Handle PDF document upload
exports.uploadPdf = async (req, res) => {
  let stored;
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No PDF file uploaded' });
    }
    if (req.file.buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
      return res.status(400).json({ success: false, message: 'The uploaded file is not a valid PDF.' });
    }

    const originalName = req.file.originalname || 'document.pdf';
    const cleanBaseName = path.basename(originalName, path.extname(originalName))
      .replace(/[^a-zA-Z0-9_\-]/g, '_')
      .slice(0, 50) || 'document';
    const uniqueSuffix = Date.now() + '-' + crypto.randomBytes(4).toString('hex');
    const safeFilename = cleanBaseName + '-' + uniqueSuffix + '.pdf';

    stored = {
      cloudinaryPublicId: null,
      cloudinaryFormat: 'pdf',
      localFilename: safeFilename,
      storage: 'local'
    };
    let storageType = 'local';

    // Keep the local copy only if Cloudinary is unavailable.
    const localFilePath = path.join(uploadsDir, safeFilename);

    if (cloudinaryConfigured) {
      try {
        const uploadResult = await new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('Cloudinary PDF upload timed out after 8 seconds')), 8000);
          const stream = cloudinary.uploader.upload_stream(
            {
              folder: `holder/${req.user.id}/pdfs`,
              resource_type: 'raw',
              type: 'authenticated',
              public_id: `${cleanBaseName}-${uniqueSuffix}.pdf`
            },
            (error, result) => {
              clearTimeout(timer);
              if (error) reject(error);
              else resolve(result);
            }
          );
          stream.on('error', (err) => {
            clearTimeout(timer);
            reject(err);
          });
          stream.end(req.file.buffer);
        });
        if (uploadResult && uploadResult.public_id) {
          storageType = 'cloudinary';
          stored = {
            cloudinaryPublicId: uploadResult.public_id,
            cloudinaryFormat: uploadResult.format || 'pdf',
            localFilename: null,
            storage: 'cloudinary'
          };
        }
      } catch (cloudErr) {
        console.error('[Cloudinary] PDF upload failed; using local storage:', cloudErr.message);
      }
    }

    if (storageType === 'cloudinary') {
      await fs.promises.unlink(localFilePath).catch(() => {});
    } else {
      await fs.promises.writeFile(localFilePath, req.file.buffer, { mode: 0o600 });
    }

    const pending = await createPendingUpload(req.user.id, req.file, stored, 'raw');
    res.json({
      success: true,
      uploadId: pending._id,
      mediaUrl: `/api/uploads/${pending._id}/media`,
      filename: originalName,
      size: req.file.size,
      storageType
    });
  } catch (error) {
    if (stored) await discardStoredMedia({ ...stored, cloudinaryResourceType: 'raw' });
    res.status(500).json({ success: false, message: error.message });
  }
};

// Seed realistic demo starter items for new users and onboarding tour
exports.seedDemoItems = async (req, res) => {
  try {
    const userId = req.user.id;
    const Folder = require('../models/Folder');

    const folders = await Folder.find({ userId });
    const travelOrPrivateFolder = folders.find(f => /private|important|personal|brand/i.test(f.name)) || folders[0];
    const learningFolder = folders.find(f => /youtube|learning|video/i.test(f.name)) || folders[0];
    const webFolder = folders.find(f => /bookmark|web|link/i.test(f.name)) || folders[0];

    const demoItems = [
      {
        userId,
        title: 'Delta Flight Confirmation & In-Flight Wi-Fi (Screenshot)',
        type: 'image',
        folderId: travelOrPrivateFolder ? travelOrPrivateFolder._id : null,
        url: 'https://delta.com/manage-trip',
        previewUrl: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=1000&auto=format&fit=crop&q=80',
        content: 'Saved e-ticket for SFO -> JFK flight. Contains seat number, gate details, and in-flight Wi-Fi credentials.',
        ocrText: 'DELTA AIR LINES — E-TICKET CONFIRMATION\nBooking Ref: HLD-8921A\nPassenger: Alex Mercer\nFlight: DL 1492 | Seat: 14C (Window)\nDepart: San Francisco (SFO) 08:30 AM -> Arrive: New York (JFK) 04:55 PM\nWi-Fi Network: Delta-InFlight (Pass: FlyDelta2026)\nCustomer portal: https://delta.com/manage-trip\nBaggage check-in support: https://help.delta.com',
        ocrStatus: 'done',
        tags: ['flight', 'screenshot', 'ticket', 'wifi', 'travel'],
        metadata: {
          detectedUrls: ['https://delta.com/manage-trip', 'https://help.delta.com'],
          size: 420100
        },
        isFavorite: true,
        pinned: true
      },
      {
        userId,
        title: 'Steve Jobs 2005 Stanford Commencement Speech',
        type: 'youtube',
        folderId: learningFolder ? learningFolder._id : null,
        url: 'https://www.youtube.com/watch?v=UF8uR6Z6KLc',
        previewUrl: 'https://img.youtube.com/vi/UF8uR6Z6KLc/hqdefault.jpg',
        content: 'Iconic talk on connecting the dots, love and loss, and mortality. "Your time is limited, so don\'t waste it living someone else\'s life. Stay Hungry, Stay Foolish."',
        tags: ['inspiration', 'youtube', 'learning', 'career'],
        metadata: {
          youtubeId: 'UF8uR6Z6KLc',
          authorName: 'Stanford University'
        },
        isFavorite: true
      },
      {
        userId,
        title: 'Tailwind CSS — Rapidly build modern websites without leaving HTML',
        type: 'link',
        folderId: webFolder ? webFolder._id : null,
        url: 'https://tailwindcss.com',
        previewUrl: 'https://tailwindcss.com/api/og',
        content: 'A utility-first CSS framework packed with classes that can be composed to build any design directly in your markup.',
        tags: ['design', 'css', 'frontend', 'developer'],
        metadata: {
          detectedUrls: ['https://tailwindcss.com']
        }
      }
    ];

    const existing = await Item.find({
      userId,
      title: { $in: demoItems.map(d => d.title) }
    });

    const itemsToInsert = demoItems.filter(d => !existing.some(e => e.title === d.title));

    let createdItems = [];
    if (itemsToInsert.length > 0) {
      createdItems = await Item.insertMany(itemsToInsert);
    }

    res.json({
      success: true,
      message: `${itemsToInsert.length} interactive demo items added to your vault!`,
      count: createdItems.length
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

async function getItemImageBuffer(item) {
  if (item.metadata?.localFilename) {
    const filePath = path.join(uploadsDir, item.metadata.localFilename);
    return await fs.promises.readFile(filePath);
  }
  if (item.metadata?.cloudinaryPublicId && cloudinaryConfigured) {
    const downloadUrl = cloudinary.utils.private_download_url(
      item.metadata.cloudinaryPublicId,
      item.metadata.cloudinaryFormat || undefined,
      {
        resource_type: 'image',
        type: item.metadata.cloudinaryType || 'authenticated',
        expires_at: Math.floor(Date.now() / 1000) + 120
      }
    );
    const resp = await axios.get(downloadUrl, { responseType: 'arraybuffer', timeout: 20000 });
    return Buffer.from(resp.data);
  }
  if (item.url && /^https?:\/\//i.test(item.url)) {
    const resp = await axios.get(item.url, { responseType: 'arraybuffer', timeout: 20000 });
    return Buffer.from(resp.data);
  }
  throw new Error('Image asset data not found on disk or storage.');
}

// Manually or automatically transcribe an item using Vision HTR
exports.transcribeItemVision = async (req, res) => {
  try {
    const { id } = req.params;
    const item = await Item.findOne({ _id: id, userId: req.user.id });
    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    if (!isVisionHtrAvailable()) {
      return res.status(400).json({
        success: false,
        message: 'Vision AI is not configured. Please add CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN in server/.env'
      });
    }

    const buffer = await getItemImageBuffer(item);
    const mimeType = item.metadata?.mimeType || 'image/jpeg';

    const result = await transcribeImageWithVision(buffer, mimeType);
    const text = String(result?.text || '').trim();
    const detectedUrls = extractUrlsFromText(text);

    item.ocrText = text;
    item.ocrStatus = 'done';
    item.ocrError = '';
    if (!item.metadata) item.metadata = {};
    item.metadata.ocrEngine = result.provider || 'vision-htr';
    item.metadata.ocrModel = result.model || '';
    if (detectedUrls.length > 0) {
      item.metadata.detectedUrls = detectedUrls;
      if (!item.url || item.url.includes('cloudinary') || item.url.includes('/uploads/')) {
        item.url = detectedUrls[0];
      }
    }
    item.markModified('metadata');
    await item.save();

    invalidateAssistantCache(req.user.id);
    const populated = await Item.findById(item._id).populate('folderId', 'name icon color');
    res.json({
      success: true,
      item: serializeItem(populated),
      provider: result.provider,
      model: result.model
    });
  } catch (error) {
    console.error('[Vision HTR] Manual transcribe failed:', error.message);
    res.status(500).json({ success: false, message: error.message || 'Vision transcription failed' });
  }
};
