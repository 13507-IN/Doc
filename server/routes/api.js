const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');

const folderController = require('../controllers/folderController');
const itemController = require('../controllers/itemController');
const metadataController = require('../controllers/metadataController');
const assistantController = require('../controllers/assistantController');

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

// Folder Routes
router.get('/folders', folderController.getFolders);
router.post('/folders', folderController.createFolder);
router.put('/folders/:id', folderController.updateFolder);
router.delete('/folders/:id', folderController.deleteFolder);

// Item Routes
router.get('/items', itemController.getItems);
router.get('/items/:id', itemController.getItemById);
router.post('/items', itemController.createItem);
router.put('/items/:id', itemController.updateItem);
router.delete('/items/:id', itemController.deleteItem);
router.patch('/items/:id/favorite', itemController.toggleFavorite);
router.patch('/items/:id/pin', itemController.togglePin);
router.post('/items/upload-image', upload.single('image'), itemController.uploadImage);

// Metadata & Scraper Routes
router.post('/metadata/extract', metadataController.extractMetadata);

// AI Assistant Query Route
router.post('/assistant/query', assistantController.queryAssistant);

module.exports = router;
