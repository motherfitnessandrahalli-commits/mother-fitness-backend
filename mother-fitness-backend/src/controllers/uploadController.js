const path = require('path');
const fs = require('fs');
let sharp;
try {
    sharp = require('sharp');
} catch (e) {
    console.error('⚠️ [Warning] sharp module failed to load. Image processing will be disabled.');
}
const { AppError, asyncHandler, sendSuccess } = require('../utils/errorHandler');
const { generateUniqueId } = require('../utils/helpers');

// Ensure uploads directory exists
const uploadDir = process.env.UPLOAD_PATH || './uploads';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const uploadPhoto = asyncHandler(async (req, res, next) => {
    if (!req.file) {
        return next(new AppError('Please provide an image file', 400));
    }

    const filename = `photo_${generateUniqueId()}_${Date.now()}.webp`;
    const filepath = path.join(uploadDir, filename);

    try {
        if (!sharp) {
            // Fallback: Save original file without processing if sharp is missing
            fs.writeFileSync(filepath, req.file.buffer);
            console.warn('⚠️ Saved file without processing because sharp is missing');
        } else {
            // Process image with Sharp
            await sharp(req.file.buffer)
                .resize(500, 500, { // Resize to 500x500 square
                    fit: 'cover',
                    position: 'center'
                })
                .toFormat('webp')
                .webp({ quality: 80 }) // Compress quality
                .toFile(filepath);
        }

        // Construct public URL
        const fileUrl = `/uploads/${filename}`;

        sendSuccess(res, 201, {
            filename,
            path: fileUrl,
            mimetype: sharp ? 'image/webp' : req.file.mimetype,
            size: req.file.size
        }, 'Photo uploaded successfully');
    } catch (error) {
        console.error('Sharp/FS Error in uploadPhoto:', error);
        return next(new AppError(`File processing failed: ${error.message}`, 500));
    }
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
