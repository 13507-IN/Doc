const Item = require('../models/Item');
const { cloudinary, configured: cloudinaryConfigured } = require('../config/cloudinary');

const DEFAULT_PAGE_SIZE = 30;
const MAX_PAGE_SIZE = 100;

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
    const { title, type, folderId, url, content, previewUrl, tags, metadata, isFavorite, isPrivate, pinned } = req.body;

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
      previewUrl: previewUrl || '',
      tags: processedTags,
      metadata: metadata || {},
      isFavorite: Boolean(isFavorite),
      isPrivate: Boolean(isPrivate),
      pinned: Boolean(pinned)
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

    const item = await Item.findOneAndUpdate({ _id: id, userId }, updateData, { new: true, runValidators: true })
      .populate('folderId', 'name icon color');

    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' });
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
    res.json({ success: true, message: 'Item deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Handle image upload
exports.uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image file uploaded' });
    }

    if (!cloudinaryConfigured) {
      return res.status(503).json({
        success: false,
        message: 'Image storage is not configured. Add Cloudinary credentials to the server environment.'
      });
    }

    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: `holder/${req.user.id}`,
          resource_type: 'image',
          allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
          transformation: [{ width: 2400, height: 2400, crop: 'limit' }]
        },
        (error, uploadResult) => error ? reject(error) : resolve(uploadResult)
      );
      stream.end(req.file.buffer);
    });

    res.json({
      success: true,
      imageUrl: result.secure_url,
      filename: req.file.originalname,
      cloudinaryPublicId: result.public_id
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
