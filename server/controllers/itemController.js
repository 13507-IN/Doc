const Item = require('../models/Item');
const { cloudinary, configured: cloudinaryConfigured } = require('../config/cloudinary');
const { enqueueItemOcr, recognize } = require('../services/ocrService');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const DEFAULT_PAGE_SIZE = 30;
const MAX_PAGE_SIZE = 100;

async function storeImage(req) {
  let imageUrl = '';
  let cloudinaryPublicId = null;
  let localFilename = null;
  let storage = 'local';

  if (cloudinaryConfigured) {
    try {
      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: `holder/${req.user.id}`,
            resource_type: 'image',
            allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
            transformation: [{ width: 2400, height: 2400, crop: 'limit' }]
          },
          (error, uploadResult) => (error ? reject(error) : resolve(uploadResult))
        );
        stream.end(req.file.buffer);
      });
      imageUrl = result.secure_url;
      cloudinaryPublicId = result.public_id;
      storage = 'cloudinary';
    } catch (error) {
      console.error('[Cloudinary] Image upload failed; falling back to local storage:', error.message);
    }
  }

  if (!imageUrl) {
    const ext = path.extname(req.file.originalname) || '.png';
    const cleanBase = path.basename(req.file.originalname, ext).replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 40) || 'img';
    localFilename = `img-${cleanBase}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`;
    await fs.promises.writeFile(path.join(uploadsDir, localFilename), req.file.buffer);
    const baseUrl = (process.env.SERVER_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
    imageUrl = `${baseUrl}/uploads/${localFilename}`;
  }

  return {
    imageUrl,
    cloudinaryPublicId,
    localFilename,
    storage,
    storageWarning: storage === 'local'
      ? 'Cloudinary is unavailable, so this image is stored on the server disk.'
      : ''
  };
}

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
      items: pageItems,
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
    res.json({ success: true, item });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Create a new item scoped to user
exports.createItem = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      title, type, folderId, url, content, previewUrl, ocrText, tags, metadata,
      isFavorite, isPrivate, pinned, expiresAt, reminderDays
    } = req.body;

    if (!title || !type) {
      return res.status(400).json({ success: false, message: 'Title and type are required' });
    }

    const processedTags = Array.isArray(tags) 
      ? tags.map(t => t.trim()).filter(Boolean)
      : (typeof tags === 'string' ? tags.split(',').map(t => t.trim()).filter(Boolean) : []);

    const item = new Item({
      userId,
      title,
      type,
      folderId: folderId || null,
      url: url || '',
      content: content || '',
      ocrText: ocrText || '',
      previewUrl: previewUrl || '',
      tags: processedTags,
      metadata: metadata || {},
      isFavorite: Boolean(isFavorite),
      isPrivate: Boolean(isPrivate),
      pinned: Boolean(pinned),
      expiresAt: expiresAt || null,
      reminderDays: Number.isFinite(Number(reminderDays)) ? Number(reminderDays) : 30
    });

    await item.save();
    const populatedItem = await Item.findById(item._id).populate('folderId', 'name icon color');

    res.status(201).json({ success: true, item: populatedItem });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update existing item
exports.updateItem = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const updateData = { ...req.body };

    if (updateData.tags && typeof updateData.tags === 'string') {
      updateData.tags = updateData.tags.split(',').map(t => t.trim()).filter(Boolean);
    }

    if (updateData.folderId === '' || updateData.folderId === 'null') {
      updateData.folderId = null;
    }
    updateData.updatedAt = new Date();

    const existingItem = await Item.findOne({ _id: id, userId }).select('metadata');
    if (!existingItem) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }
    const item = await Item.findOneAndUpdate({ _id: id, userId }, updateData, { new: true, runValidators: true })
      .populate('folderId', 'name icon color');

    const oldPublicId = existingItem.metadata?.cloudinaryPublicId;
    const newPublicId = item.metadata?.cloudinaryPublicId;
    if (oldPublicId && oldPublicId !== newPublicId && cloudinaryConfigured) {
      cloudinary.uploader.destroy(oldPublicId).catch((error) => {
        console.warn(`Unable to remove replaced Cloudinary asset ${oldPublicId}:`, error.message);
      });
    }

    const oldLocal = existingItem.metadata?.localFilename;
    const newLocal = item.metadata?.localFilename;
    if (oldLocal && oldLocal !== newLocal) {
      fs.promises.unlink(path.join(uploadsDir, oldLocal)).catch(() => {});
    }

    res.json({ success: true, item });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
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
    res.json({ success: true, item });
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
    res.json({ success: true, item });
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
    const publicId = item.metadata?.cloudinaryPublicId;
    if (publicId && cloudinaryConfigured) {
      cloudinary.uploader.destroy(publicId).catch((error) => {
        console.warn(`Unable to remove Cloudinary asset ${publicId}:`, error.message);
      });
    }

    const localFilename = item.metadata?.localFilename;
    if (localFilename) {
      fs.promises.unlink(path.join(uploadsDir, localFilename)).catch(() => {});
    }
    res.json({ success: true, message: 'Item deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Handle image upload with Cloudinary and local disk fallback
exports.uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image file uploaded' });
    }

    let ocrText = '';
    if (req.query.ocr === 'true') {
      try {
        ocrText = await recognize(req.file.buffer);
      } catch (ocrErr) {
        console.error('[OCR] Synchronous processing failed:', ocrErr.message);
      }
    }
    const stored = await storeImage(req);

    res.json({
      success: true,
      imageUrl: stored.imageUrl,
      filename: req.file.originalname,
      cloudinaryPublicId: stored.cloudinaryPublicId,
      localFilename: stored.localFilename,
      storage: stored.storage,
      storageWarning: stored.storageWarning,
      ocrText,
      ocrStatus: ocrText ? 'done' : 'none'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Save a screenshot immediately, then read its text in the background.
exports.createScreenshot = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No screenshot uploaded' });
    }

    const stored = await storeImage(req);
    const userTags = String(req.body.tags || '')
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
    const item = await Item.create({
      userId: req.user.id,
      title: String(req.body.title || `Screenshot — ${new Date().toLocaleString()}`).slice(0, 200),
      type: 'image',
      folderId: req.body.folderId || null,
      url: req.body.url || '',
      content: req.body.content || '',
      previewUrl: stored.imageUrl,
      tags: [...new Set(['screenshot', 'quick-clip', ...userTags])],
      metadata: {
        ...(req.body.metadata && typeof req.body.metadata === 'object' ? req.body.metadata : {}),
        cloudinaryPublicId: stored.cloudinaryPublicId,
        localFilename: stored.localFilename
      },
      ocrStatus: 'pending'
    });

    res.status(201).json({
      success: true,
      item,
      storage: stored.storage,
      storageWarning: stored.storageWarning,
      message: 'Screenshot saved. Text is being read in the background.'
    });

    enqueueItemOcr(item._id, req.file.buffer);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Handle PDF document upload
exports.uploadPdf = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No PDF file uploaded' });
    }

    const originalName = req.file.originalname || 'document.pdf';
    const cleanBaseName = path.basename(originalName, path.extname(originalName))
      .replace(/[^a-zA-Z0-9_\-]/g, '_')
      .slice(0, 50) || 'document';
    const uniqueSuffix = Date.now() + '-' + crypto.randomBytes(4).toString('hex');
    const safeFilename = cleanBaseName + '-' + uniqueSuffix + '.pdf';

    let pdfUrl = '';
    let storageType = 'local';
    let cloudinaryPublicId = null;

    // Save to local uploads directory (dependable and fast)
    const localFilePath = path.join(uploadsDir, safeFilename);
    await fs.promises.writeFile(localFilePath, req.file.buffer);

    const baseUrl = (process.env.SERVER_URL || (req.protocol + '://' + req.get('host'))).replace(/\/$/, '');
    pdfUrl = baseUrl + '/uploads/' + safeFilename;

    if (cloudinaryConfigured) {
      try {
        const uploadResult = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            {
              folder: `holder/${req.user.id}/pdfs`,
              resource_type: 'raw',
              public_id: cleanBaseName + '-' + uniqueSuffix,
              format: 'pdf'
            },
            (error, result) => (error ? reject(error) : resolve(result))
          );
          stream.end(req.file.buffer);
        });
        if (uploadResult && uploadResult.secure_url) {
          pdfUrl = uploadResult.secure_url;
          storageType = 'cloudinary';
          cloudinaryPublicId = uploadResult.public_id;
        }
      } catch (cloudErr) {
        console.error('[Cloudinary] PDF upload failed; using local storage:', cloudErr.message);
      }
    }

    res.json({
      success: true,
      pdfUrl,
      filename: originalName,
      size: req.file.size,
      storageType,
      localFilename: storageType === 'local' ? safeFilename : null,
      cloudinaryPublicId
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
