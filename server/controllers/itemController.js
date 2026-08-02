const Item = require('../models/Item');
const path = require('path');
const fs = require('fs');

// Get all items with optional query parameters (folderId, type, search, isFavorite, tag)
exports.getItems = async (req, res) => {
  try {
    const { folderId, type, search, isFavorite, tag } = req.query;

    const query = {};

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

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { title: searchRegex },
        { content: searchRegex },
        { tags: searchRegex },
        { url: searchRegex }
      ];
    }

    const items = await Item.find(query)
      .populate('folderId', 'name icon color')
      .sort({ pinned: -1, createdAt: -1 });

    res.json({
      success: true,
      count: items.length,
      items
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get single item by ID
exports.getItemById = async (req, res) => {
  try {
    const item = await Item.findById(req.params.id).populate('folderId', 'name icon color');
    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }
    res.json({ success: true, item });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Create a new item
exports.createItem = async (req, res) => {
  try {
    const { title, type, folderId, url, content, previewUrl, tags, metadata, isFavorite, isPrivate, pinned } = req.body;

    if (!title || !type) {
      return res.status(400).json({ success: false, message: 'Title and type are required' });
    }

    const processedTags = Array.isArray(tags) 
      ? tags.map(t => t.trim()).filter(Boolean)
      : (typeof tags === 'string' ? tags.split(',').map(t => t.trim()).filter(Boolean) : []);

    const item = new Item({
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

// Update an existing item
exports.updateItem = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    if (updateData.tags && typeof updateData.tags === 'string') {
      updateData.tags = updateData.tags.split(',').map(t => t.trim()).filter(Boolean);
    }

    if (updateData.folderId === '' || updateData.folderId === 'null') {
      updateData.folderId = null;
    }

    const item = await Item.findByIdAndUpdate(id, updateData, { new: true, runValidators: true })
      .populate('folderId', 'name icon color');

    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    res.json({ success: true, item });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Toggle favorite status
exports.toggleFavorite = async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }
    item.isFavorite = !item.isFavorite;
    await item.save();
    res.json({ success: true, item });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Toggle pinned status
exports.togglePin = async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }
    item.pinned = !item.pinned;
    await item.save();
    res.json({ success: true, item });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete item
exports.deleteItem = async (req, res) => {
  try {
    const item = await Item.findByIdAndDelete(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }
    res.json({ success: true, message: 'Item deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Handle Image Upload Endpoint
exports.uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image file uploaded' });
    }

    const host = req.get('host');
    const protocol = req.protocol;
    const imageUrl = `${protocol}://${host}/uploads/${req.file.filename}`;

    res.json({
      success: true,
      imageUrl,
      filename: req.file.filename
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
