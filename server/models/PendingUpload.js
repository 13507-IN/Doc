const mongoose = require('mongoose');

const pendingUploadSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  storage: { type: String, enum: ['local', 'cloudinary'], required: true },
  localFilename: { type: String, default: null },
  cloudinaryPublicId: { type: String, default: null },
  cloudinaryResourceType: { type: String, enum: ['image', 'raw'], required: true },
  cloudinaryFormat: { type: String, default: '' },
  mimeType: { type: String, required: true },
  filename: { type: String, required: true },
  size: { type: Number, required: true },
  expiresAt: { type: Date, required: true }
}, { timestamps: true });

pendingUploadSchema.index({ expiresAt: 1 });

module.exports = mongoose.model('PendingUpload', pendingUploadSchema);
