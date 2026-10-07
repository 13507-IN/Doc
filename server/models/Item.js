const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['youtube', 'image', 'link', 'note', 'document', 'pdf'],
    required: true
  },
  folderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Folder',
    default: null
  },
  url: {
    type: String,
    default: ''
  },
  content: {
    type: String,
    default: ''
  },
  ocrText: {
    type: String,
    default: ''
  },
  ocrStatus: {
    type: String,
    enum: ['none', 'pending', 'processing', 'done', 'failed'],
    default: 'none'
  },
  ocrError: {
    type: String,
    default: ''
  },
  previewUrl: {
    type: String,
    default: ''
  },
  tags: [{
    type: String,
    trim: true
  }],
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  isFavorite: {
    type: Boolean,
    default: false
  },
  isPrivate: {
    type: Boolean,
    default: false
  },
  pinned: {
    type: Boolean,
    default: false
  },
  expiresAt: {
    type: Date,
    default: null
  },
  reminderDays: {
    type: Number,
    default: 30,
    min: 0,
    max: 365
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

itemSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

itemSchema.index({ userId: 1, title: 'text', content: 'text', ocrText: 'text', tags: 'text', url: 'text' });
itemSchema.index({ userId: 1, pinned: -1, createdAt: -1, _id: -1 });
itemSchema.index({ userId: 1, folderId: 1, pinned: -1, createdAt: -1, _id: -1 });
itemSchema.index({ userId: 1, type: 1, pinned: -1, createdAt: -1, _id: -1 });
itemSchema.index({ userId: 1, isFavorite: 1, pinned: -1, createdAt: -1, _id: -1 });
itemSchema.index({ userId: 1, expiresAt: 1 });

module.exports = mongoose.model('Item', itemSchema);
