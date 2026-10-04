const express = require('express');
const router = express.Router();
const passport = require('passport');
const multer = require('multer');

const authController = require('../controllers/authController');
const folderController = require('../controllers/folderController');
const itemController = require('../controllers/itemController');
const metadataController = require('../controllers/metadataController');
const assistantController = require('../controllers/assistantController');
const profileController = require('../controllers/profileController');
const authMiddleware = require('../middleware/auth');

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
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) {
      return cb(new Error('Only JPEG, PNG, WebP, and GIF images are allowed'));
    }
    cb(null, true);
  }
});

// Public Auth Routes
router.post('/auth/register', authController.register);
router.post('/auth/login', authController.login);
router.get('/auth/me', authMiddleware, authController.getMe);

// Google OAuth Passport Routes
router.get('/auth/google', (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(400).json({ 
      success: false, 
      message: 'Google OAuth is not configured on the server. Please add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to environment variables.' 
    });
  }
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })(req, res, next);
});

router.get('/auth/google/callback', 
  passport.authenticate('google', { failureRedirect: '/login', session: false }), 
  authController.googleCallback
);

// Public Metadata Scraper Route
router.post('/metadata/extract', metadataController.extractMetadata);

// Protected Folder Routes
router.get('/folders', authMiddleware, folderController.getFolders);
router.post('/folders', authMiddleware, folderController.createFolder);
router.put('/folders/:id', authMiddleware, folderController.updateFolder);
router.delete('/folders/:id', authMiddleware, folderController.deleteFolder);

// Protected Item Routes
router.get('/items', authMiddleware, itemController.getItems);
router.get('/items/:id', authMiddleware, itemController.getItemById);
router.post('/items', authMiddleware, itemController.createItem);
router.put('/items/:id', authMiddleware, itemController.updateItem);
router.delete('/items/:id', authMiddleware, itemController.deleteItem);
router.patch('/items/:id/favorite', authMiddleware, itemController.toggleFavorite);
router.patch('/items/:id/pin', authMiddleware, itemController.togglePin);
router.post('/items/upload-image', authMiddleware, upload.single('image'), itemController.uploadImage);
router.post('/items/upload-pdf', authMiddleware, uploadPdf.single('pdf'), itemController.uploadPdf);

// Saved form profiles
router.get('/profiles', authMiddleware, profileController.getProfiles);
router.post('/profiles', authMiddleware, profileController.createProfile);
router.put('/profiles/:id', authMiddleware, profileController.updateProfile);
router.delete('/profiles/:id', authMiddleware, profileController.deleteProfile);

// Protected AI Assistant Query Route
router.post('/assistant/query', authMiddleware, assistantController.queryAssistant);

module.exports = router;
