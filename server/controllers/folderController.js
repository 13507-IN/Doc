const Folder = require('../models/Folder');
const Item = require('../models/Item');

// Get all folders for the authenticated user
exports.getFolders = async (req, res) => {
  try {
    const userId = req.user.id;
    const [folders, itemCounts] = await Promise.all([
      Folder.find({ userId }).sort({ createdAt: -1 }).lean(),
      Item.aggregate([
        { $match: { userId: new (require('mongoose').Types.ObjectId)(userId) } },
        { $group: { _id: '$folderId', itemCount: { $sum: 1 } } }
      ])
    ]);

    const countByFolder = new Map(
      itemCounts
        .filter(({ _id }) => _id !== null)
        .map(({ _id, itemCount }) => [_id.toString(), itemCount])
    );
    const uncategorizedCount = itemCounts.find(({ _id }) => _id === null)?.itemCount || 0;
    const foldersWithCount = folders.map((folder) => ({
      ...folder,
      itemCount: countByFolder.get(folder._id.toString()) || 0
    }));

    res.json({
      success: true,
      folders: foldersWithCount,
      uncategorizedCount
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Create a new folder for the authenticated user
exports.createFolder = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, description, icon, color, isPrivate } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Folder name is required' });
    }

    const folder = new Folder({
      userId,
      name,
      description: description || '',
      icon: icon || '📁',
      color: color || '#6366f1',
      isPrivate: Boolean(isPrivate)
    });

    await folder.save();
    res.status(201).json({ success: true, folder });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update folder
exports.updateFolder = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { name, description, icon, color, isPrivate } = req.body;

    const folder = await Folder.findOneAndUpdate(
      { _id: id, userId },
      { name, description, icon, color, isPrivate },
      { new: true, runValidators: true }
    );

    if (!folder) {
      return res.status(404).json({ success: false, message: 'Folder not found' });
    }

    res.json({ success: true, folder });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete folder
exports.deleteFolder = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { deleteItems } = req.query;

    const folder = await Folder.findOneAndDelete({ _id: id, userId });
    if (!folder) {
      return res.status(404).json({ success: false, message: 'Folder not found' });
    }

    if (deleteItems === 'true') {
      await Item.deleteMany({ userId, folderId: id });
    } else {
      await Item.updateMany({ userId, folderId: id }, { $set: { folderId: null } });
    }

    res.json({ success: true, message: 'Folder deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
