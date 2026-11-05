const express = require('express');
const router = express.Router();
const passport = require('passport');
const multer = require('multer');
const rateLimit = require('express-rate-limit');

const authController = require('../controllers/authController');
const folderController = require('../controllers/folderController');
const itemController = require('../controllers/itemController');
const metadataController = require('../controllers/metadataController');
const assistantController = require('../controllers/assistantController');
const profileController = require('../controllers/profileController');
const authMiddleware = require('../middleware/auth');

const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Too many authentication attempts. Try again in 15 minutes.' }
});

const metadataRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 50,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Too many metadata requests. Try again later.' }
});

const userActionRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  keyGenerator: (req) => req.user?.id || req.ip,
  validate: { ip: false },
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Too many uploads. Try again later.' }
});

const assistantRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  keyGenerator: (req) => req.user?.id || req.ip,
  validate: { ip: false },
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Too many assistant requests. Try again in 15 minutes.' }
});

// Multer Storage Configuration for PDF Uploads
const uploadPdf = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const isPdfMime = file.mimetype === 'application/pdf';
    const isPdfExt = file.originalname && file.originalname.toLowerCase().endsWith('.pdf');
    if (!isPdfMime && !isPdfExt) {
      return cb(new Error('Only PDF documents (.pdf) are allowed'));
    }
    cb(null, true);
  }
});

// Multer Storage Configuration for Image Uploads
const upload = multer({
  storage: multer.memoryStorage(),
  // High-DPI browser screenshots routinely exceed 10 MB as PNGs.
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) {
      return cb(new Error('Only JPEG, PNG, WebP, and GIF images are allowed'));
    }
    cb(null, true);
  }
});

// Public Auth Routes
router.post('/auth/register', authRateLimit, authController.register);
router.post('/auth/login', authRateLimit, authController.login);
router.post('/auth/oauth/exchange', authRateLimit, authController.exchangeGoogleCode);
router.get('/auth/me', authMiddleware, authController.getMe);

// Google OAuth Passport Routes
router.get('/auth/google', (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(400).json({ 
      success: false, 
      message: 'Google OAuth is not configured on the server. Please add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to environment variables.' 
    });
  }
  passport.authenticate('google', { scope: ['profile', 'email'], state: true })(req, res, next);
});

router.get('/auth/google/callback', 
  passport.authenticate('google', { failureRedirect: `${process.env.CLIENT_URL || 'http://localhost:3000'}/?error=oauth_failed`, session: false }),
  authController.googleCallback
);

// Public Metadata Scraper Route
router.post('/metadata/extract', metadataRateLimit, metadataController.extractMetadata);

// Protected Folder Routes
router.get('/folders', authMiddleware, folderController.getFolders);
router.post('/folders', authMiddleware, folderController.createFolder);
router.put('/folders/:id', authMiddleware, folderController.updateFolder);
router.delete('/folders/:id', authMiddleware, folderController.deleteFolder);

// Protected Item Routes
router.get('/items', authMiddleware, itemController.getItems);
router.get('/items/:id', authMiddleware, itemController.getItemById);
router.get('/items/:id/media', authMiddleware, itemController.getItemMedia);
router.get('/uploads/:id/media', authMiddleware, itemController.getPendingUploadMedia);
router.delete('/uploads/:id', authMiddleware, itemController.deletePendingUpload);
router.post('/items', authMiddleware, itemController.createItem);
router.post('/items/seed-demo', authMiddleware, itemController.seedDemoItems);
router.put('/items/:id', authMiddleware, itemController.updateItem);
router.delete('/items/:id', authMiddleware, itemController.deleteItem);
router.patch('/items/:id/favorite', authMiddleware, itemController.toggleFavorite);
router.patch('/items/:id/pin', authMiddleware, itemController.togglePin);
router.post('/items/upload-image', authMiddleware, userActionRateLimit, upload.single('image'), itemController.uploadImage);
router.post('/items/screenshot', authMiddleware, userActionRateLimit, upload.single('image'), itemController.createScreenshot);
router.post('/items/upload-pdf', authMiddleware, userActionRateLimit, uploadPdf.single('pdf'), itemController.uploadPdf);
router.post('/items/:id/transcribe-vision', authMiddleware, userActionRateLimit, itemController.transcribeItemVision);

// Multer otherwise falls through to Express's HTML error page. API clients
// need a JSON response they can show to the user.
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    const message = error.code === 'LIMIT_FILE_SIZE'
      ? 'The file is too large. The maximum upload size is 25 MB.'
      : error.message;
    return res.status(400).json({ success: false, message });
  }
  if (error) {
    return res.status(400).json({ success: false, message: error.message || 'Upload failed' });
  }
  next();
});

// Saved form profiles
router.get('/profiles', authMiddleware, profileController.getProfiles);
router.post('/profiles', authMiddleware, profileController.createProfile);
router.put('/profiles/:id', authMiddleware, profileController.updateProfile);
router.delete('/profiles/:id', authMiddleware, profileController.deleteProfile);

// Protected retrieval-augmented assistant route with a per-user model-call limit.
router.post('/assistant/query', authMiddleware, assistantRateLimit, assistantController.queryAssistant);

module.exports = router;
