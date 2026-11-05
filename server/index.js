const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
dotenv.config();

const passport = require('passport');
const session = require('express-session');
const { getJwtSecret, getSessionSecret } = require('./config/security');
const { MongoMemoryServer } = require('mongodb-memory-server');
const configurePassport = require('./config/passport');
const { verifyCloudinary } = require('./config/cloudinary');
const { initWorker: initOcrWorker } = require('./services/ocrService');

const app = express();
const PORT = process.env.PORT || 5000;
const isProduction = process.env.NODE_ENV === 'production';
const configuredClientUrl = (process.env.CLIENT_URL || '').trim().replace(/\/$/, '');
const configuredClientOrigins = (process.env.CLIENT_URLS || process.env.CLIENT_URL || '')
  .split(',')
  .map((origin) => origin.trim().replace(/\/$/, ''))
  .filter(Boolean);
if (isProduction && configuredClientUrl) {
  for (const origin of new Set([configuredClientUrl, ...configuredClientOrigins])) {
    try {
      const parsedOrigin = new URL(origin);
      if (parsedOrigin.protocol !== 'https:' || parsedOrigin.origin !== origin) {
        console.warn(`[Security] Warning: Production client origin ${origin} should use HTTPS.`);
      }
    } catch {
      console.warn(`[Security] Warning: Invalid client origin configured: ${origin}`);
    }
  }
} else if (isProduction && !configuredClientUrl) {
  console.warn('[Security] CLIENT_URL is not set in production. Dynamic client requests (including Vercel deployments) will be permitted.');
}
const allowedOrigins = new Set([
  ...(!isProduction ? ['http://localhost:3000'] : []),
  ...configuredClientOrigins,
  ...(configuredClientUrl ? [configuredClientUrl] : []),
  ...(process.env.EXTENSION_ORIGIN ? [process.env.EXTENSION_ORIGIN.trim()] : [])
]);

// Validate secrets before the server accepts any requests.
getJwtSecret();
const sessionSecret = getSessionSecret();

// Ensure uploads folder exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true, mode: 0o700 });
}
try {
  fs.chmodSync(uploadsDir, 0o700);
} catch (error) {
  console.warn('[Uploads] Could not apply private directory permissions:', error.message);
}

// Middleware
if (isProduction) app.set('trust proxy', 1);
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));
app.use(compression({ threshold: 1024, level: 6 }));
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    try {
      const parsed = new URL(origin);
      if (
        parsed.hostname.endsWith('.vercel.app') ||
        parsed.hostname === 'localhost' ||
        parsed.hostname === '127.0.0.1'
      ) {
        return callback(null, true);
      }
    } catch {}
    if (allowedOrigins.size === 0) return callback(null, true);
    return callback(new Error('Origin is not allowed by CORS.'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type'],
  maxAge: 600
}));
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use('/api', (req, res, next) => {
  res.set({
    'Cache-Control': 'private, no-store, max-age=0',
    Pragma: 'no-cache',
    'Referrer-Policy': 'no-referrer'
  });
  next();
});

// Express Session & Passport Middleware
app.use(
  session({
    name: 'holder.oauth',
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000
    }
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
    message: 'Database is connecting or unavailable. Check the database URI and the database provider’s network-access rules.'
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
    message: 'Holder Vault Search API is running'
  });
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'API route not found' });
});

app.use((error, req, res, next) => {
  if (error.message === 'Origin is not allowed by CORS.') {
    return res.status(403).json({ success: false, message: 'This origin is not allowed.' });
  }
  console.error('[API] Unhandled error:', error.message);
  const status = Number.isInteger(error.status) && error.status >= 400 && error.status < 500
    ? error.status
    : 500;
  res.status(status).json({
    success: false,
    message: status < 500 ? 'The request could not be processed.' : 'Something went wrong. Please try again.'
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
    console.log('[MongoDB] Connected to MongoDB server successfully.');
  } catch (err) {
    if (process.env.NODE_ENV === 'production') {
      console.error(`[MongoDB] Connection error: ${err.message}. In-memory fallback is disabled in production.`);
      return;
    }

    console.warn(`[MongoDB] Connection error: ${err.message}. Attempting MongoMemoryServer Fallback...`);
    try {
      const mongod = await MongoMemoryServer.create({
        binary: {
          version: '7.0.3'
        }
      });
      const memoryUri = mongod.getUri();
      await mongoose.connect(memoryUri, { dbName: 'holder_db' });
      console.log(`[MongoDB] Connected to In-Memory MongoDB instance at: ${memoryUri}`);
    } catch (memErr) {
      console.error('[MongoDB] Failed to start In-Memory MongoDB:', memErr.message);
    }
  }
}

connectDB().then(() => {
  verifyCloudinary();
  initOcrWorker().catch(() => {});
  const { cleanupExpiredUploads } = require('./controllers/itemController');
  cleanupExpiredUploads().catch((error) => {
    console.error('[Uploads] Initial pending-upload cleanup failed:', error.message);
  });
  const uploadCleanupTimer = setInterval(() => {
    cleanupExpiredUploads().catch((error) => {
      console.error('[Uploads] Pending-upload cleanup failed:', error.message);
    });
  }, 30 * 60 * 1000);
  uploadCleanupTimer.unref();
  app.listen(PORT, () => {
    console.log(`[Server] Holder API ready on port http://localhost:${PORT}`);
  });
});
