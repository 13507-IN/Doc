const Item = require('../models/Item');

// Get items scoped to authenticated user
exports.getItems = async (req, res) => {
  try {
    const userId = req.user.id;
    const { folderId, type, search, isFavorite, tag } = req.query;

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
    const item = await Item.findOne({ _id: req.params.id, userId });
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

// Toggle pin
exports.togglePin = async (req, res) => {
  try {
    const userId = req.user.id;
    const item = await Item.findOne({ _id: req.params.id, userId });
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
    const userId = req.user.id;
    const item = await Item.findOneAndDelete({ _id: req.params.id, userId });
    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' });
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
