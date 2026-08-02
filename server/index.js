const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const { MongoMemoryServer } = require('mongodb-memory-server');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Ensure uploads folder exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/uploads', express.static(uploadsDir));

// API Routes
const apiRoutes = require('./routes/api');
app.use('/api', apiRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Holder Personal Assistant API is running smoothly' });
});

// Database Connection with Memory Fallback
async function connectDB() {
  const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/holder_db';
  
  try {
    console.log(`Connecting to MongoDB at: ${MONGO_URI}...`);
    await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 3000 });
    console.log('✅ Connected to MongoDB server successfully.');
  } catch (err) {
    console.warn('⚠️ Local MongoDB connection failed or not running. Initializing In-Memory MongoDB Fallback...');
    try {
      const mongod = await MongoMemoryServer.create();
      const memoryUri = mongod.getUri();
      await mongoose.connect(memoryUri);
      console.log(`🚀 Connected to In-Memory MongoDB instance at: ${memoryUri}`);
    } catch (memErr) {
      console.error('❌ Failed to start In-Memory MongoDB:', memErr.message);
    }
  }

  // Seed default folders if empty
  try {
    const Folder = require('./models/Folder');
    const folderCount = await Folder.countDocuments();
    if (folderCount === 0) {
      console.log('🌱 Seeding initial folders...');
      await Folder.insertMany([
        { name: 'Brand Assets', description: 'Logos, colors, brand guidelines, key media links', icon: '💼', color: '#6366f1' },
        { name: 'Private & Important', description: 'Vault for highly confidential notes, codes & credentials', icon: '🔒', color: '#ec4899', isPrivate: true },
        { name: 'YouTube & Learning', description: 'Saved YouTube videos, tutorials, tech lectures', icon: '🎥', color: '#ef4444' },
        { name: 'Web Bookmarks', description: 'Important websites, articles, docs', icon: '🌐', color: '#10b981' }
      ]);
      console.log('✅ Default folders seeded successfully.');
    }
  } catch (seedErr) {
    console.error('Error seeding default folders:', seedErr.message);
  }
}

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`⚡ Holder Server ready on port http://localhost:${PORT}`);
  });
});
