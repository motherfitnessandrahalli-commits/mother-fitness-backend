const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const { AppError, asyncHandler, sendSuccess } = require('../utils/errorHandler');
const { generateUniqueId } = require('../utils/helpers');

// Ensure uploads directory exists
const uploadDir = process.env.UPLOAD_PATH || './uploads';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

/**
 * @desc    Upload customer photo
 * @route   POST /api/upload
 * @access  Private
 */
const uploadPhoto = asyncHandler(async (req, res, next) => {
    if (!req.file) {
        return next(new AppError('Please upload a file', 400));
    }

    // Generate unique filename
    const filename = `photo_${generateUniqueId()}_${Date.now()}.webp`;
    const filepath = path.join(uploadDir, filename);

    // Process image with Sharp
    await sharp(req.file.buffer)
        .resize(500, 500, { // Resize to 500x500 square
            fit: 'cover',
            position: 'center'
        })
        .toFormat('webp')
        .webp({ quality: 80 }) // Compress quality
        .toFile(filepath);

    // Construct public URL
    // In production, this would be a CDN URL or relative path
    const fileUrl = `/uploads/${filename}`;

    sendSuccess(res, 201, {
        filename,
        path: fileUrl,
        mimetype: 'image/webp',
        size: req.file.size // Original size, processed size will be smaller
    }, 'Photo uploaded successfully');
});

/**
 * @desc    Delete photo
 * @route   DELETE /api/upload/:filename
 * @access  Private
 */
const deletePhoto = asyncHandler(async (req, res, next) => {
    const { filename } = req.params;

    // Prevent directory traversal
    const safeFilename = path.basename(filename);
    const filepath = path.join(uploadDir, safeFilename);

    if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
        sendSuccess(res, 200, null, 'Photo deleted successfully');
    } else {
        return next(new AppError('File not found', 404));
    }
});

module.exports = {
    uploadPhoto,
    deletePhoto
};
