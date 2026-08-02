const Folder = require('../models/Folder');
const Item = require('../models/Item');

// Get all folders with item counts
exports.getFolders = async (req, res) => {
  try {
    const folders = await Folder.find().sort({ createdAt: -1 });
    
    // Get item counts for each folder
    const foldersWithCount = await Promise.all(folders.map(async (folder) => {
      const itemCount = await Item.countDocuments({ folderId: folder._id });
      return {
        ...folder.toObject(),
        itemCount
      };
    }));

    // Get count of uncategorized items (folderId: null)
    const uncategorizedCount = await Item.countDocuments({ folderId: null });

    res.json({
      success: true,
      folders: foldersWithCount,
      uncategorizedCount
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Create a new folder
exports.createFolder = async (req, res) => {
  try {
    const { name, description, icon, color, isPrivate } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Folder name is required' });
    }

    const folder = new Folder({
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
    const { id } = req.params;
    const { name, description, icon, color, isPrivate } = req.body;

    const folder = await Folder.findByIdAndUpdate(
      id,
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

// Delete folder (optionally delete or unassign items inside)
exports.deleteFolder = async (req, res) => {
  try {
    const { id } = req.params;
    const { deleteItems } = req.query;

    const folder = await Folder.findByIdAndDelete(id);
    if (!folder) {
      return res.status(404).json({ success: false, message: 'Folder not found' });
    }

    if (deleteItems === 'true') {
      await Item.deleteMany({ folderId: id });
    } else {
      // Unassign folderId from items
      await Item.updateMany({ folderId: id }, { $set: { folderId: null } });
    }

    res.json({ success: true, message: 'Folder deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
