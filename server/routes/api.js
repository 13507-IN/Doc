const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');

const authController = require('../controllers/authController');
const folderController = require('../controllers/folderController');
const itemController = require('../controllers/itemController');
const metadataController = require('../controllers/metadataController');
const assistantController = require('../controllers/assistantController');
const authMiddleware = require('../middleware/auth');

// Multer Storage Configuration for Image Uploads
const uploadsDir = path.join(__dirname, '../uploads');
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'img-' + uniqueSuffix + ext);
  }
});
const upload = multer({ storage });

// Public Auth Routes
router.post('/auth/register', authController.register);
router.post('/auth/login', authController.login);
router.get('/auth/me', authMiddleware, authController.getMe);

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

// Protected AI Assistant Query Route
router.post('/assistant/query', authMiddleware, assistantController.queryAssistant);

module.exports = router;
