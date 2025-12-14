const express = require('express');
const { uploadPhoto, deletePhoto } = require('../controllers/uploadController');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

// Protect all routes
router.use(protect);

// Upload route (single file, field name 'photo')
router.post('/', upload.single('photo'), uploadPhoto);

// Delete route
router.delete('/:filename', deletePhoto);

module.exports = router;
