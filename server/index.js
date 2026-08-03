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

// Database Readiness Check Middleware
app.use(async (req, res, next) => {
  if (req.path === '/health') return next();

  if (mongoose.connection.readyState === 1) {
    return next();
  }

  if (mongoose.connection.readyState === 2) {
    let checkAttempts = 0;
    while (mongoose.connection.readyState === 2 && checkAttempts < 15) {
      await new Promise(resolve => setTimeout(resolve, 300));
      checkAttempts++;
    }
    if (mongoose.connection.readyState === 1) return next();
  }

  return res.status(503).json({
    success: false,
    message: 'Database is connecting or unavailable. Please ensure MongoDB Atlas Network Access is set to allow connections (0.0.0.0/0).'
  });
});

// API Routes
const apiRoutes = require('./routes/api');
app.use('/api', apiRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    dbState: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    message: 'Holder Personal Assistant API is running' 
  });
});

// Database Connection
async function connectDB() {
  const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/holder_db';

  try {
    console.log(`Connecting to MongoDB...`);
    await mongoose.connect(MONGO_URI, { 
      dbName: 'holder_db',
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 15000
    });
    console.log('✅ Connected to MongoDB server successfully.');
  } catch (err) {
    console.warn(`⚠️ MongoDB connection error: ${err.message}. Attempting MongoMemoryServer Fallback...`);
    try {
      const mongod = await MongoMemoryServer.create({
        binary: {
          version: '7.0.3'
        }
      });
      const memoryUri = mongod.getUri();
      await mongoose.connect(memoryUri, { dbName: 'holder_db' });
      console.log(`🚀 Connected to In-Memory MongoDB instance at: ${memoryUri}`);
    } catch (memErr) {
      console.error('❌ Failed to start In-Memory MongoDB:', memErr.message);
    }
  }
}

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`⚡ Holder Server ready on port http://localhost:${PORT}`);
  });
});
