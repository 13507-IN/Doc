const Profile = require('../models/Profile');

exports.getProfiles = async (req, res) => {
  try {
    const profiles = await Profile.find({ userId: req.user.id }).sort({ updatedAt: -1 }).lean();
    res.json({ success: true, profiles });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createProfile = async (req, res) => {
  try {
    const { name, category, fields } = req.body;
    if (!name || !fields || typeof fields !== 'object') {
      return res.status(400).json({ success: false, message: 'Profile name and fields are required' });
    }
    const cleanFields = Object.fromEntries(
      Object.entries(fields).filter(([key, value]) => key.trim() && typeof value === 'string' && value.trim())
    );
    const profile = await Profile.create({ userId: req.user.id, name, category, fields: cleanFields });
    res.status(201).json({ success: true, profile });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { name, category, fields } = req.body;
    const profile = await Profile.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { name, category, fields, updatedAt: new Date() },
      { new: true, runValidators: true }
    );
    if (!profile) return res.status(404).json({ success: false, message: 'Profile not found' });
    res.json({ success: true, profile });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteProfile = async (req, res) => {
  try {
    const profile = await Profile.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    if (!profile) return res.status(404).json({ success: false, message: 'Profile not found' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
