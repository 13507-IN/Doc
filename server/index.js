const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const passport = require('passport');
const session = require('express-session');
const { MongoMemoryServer } = require('mongodb-memory-server');
const configurePassport = require('./config/passport');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Ensure uploads folder exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Middleware
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors());
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use('/uploads', express.static(uploadsDir));

// Express Session & Passport Middleware
app.use(
  session({
    secret: process.env.JWT_SECRET || 'holder_session_secret_13507',
    resave: false,
    saveUninitialized: false
  })
);
app.use(passport.initialize());
app.use(passport.session());
configurePassport();

// Database Readiness Check Middleware
app.use(async (req, res, next) => {
  if (req.path === '/health' || req.path.startsWith('/api/auth/google')) return next();

  if (mongoose.connection.readyState === 1) {
    return next();
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
    if (process.env.NODE_ENV === 'production') {
      console.error(`❌ MongoDB connection error: ${err.message}. In-memory fallback is disabled in production.`);
      return;
    }

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
