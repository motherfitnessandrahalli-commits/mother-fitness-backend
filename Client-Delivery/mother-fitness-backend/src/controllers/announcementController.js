const Announcement = require('../models/Announcement');

// @desc    Create new announcement
// @route   POST /api/announcements
// @access  Private (Admin)
exports.createAnnouncement = async (req, res, next) => {
    try {
        const { title, message, startDate, endDate, type } = req.body;

        const announcement = await Announcement.create({
            title,
            message,
            startDate,
            endDate,
            type,
            createdBy: req.user.id
        });

        res.status(201).json({
            success: true,
            data: announcement
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get all announcements (Admin)
// @route   GET /api/announcements/admin
// @access  Private (Admin)
exports.getAllAnnouncements = async (req, res, next) => {
    try {
        const announcements = await Announcement.find().sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: announcements.length,
            data: announcements
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get active announcements (Public/Member)
// @route   GET /api/announcements/active
// @access  Private (Member/Admin)
exports.getActiveAnnouncements = async (req, res, next) => {
    try {
        const now = new Date();

        const announcements = await Announcement.find({
            isActive: true,
            startDate: { $lte: now },
            endDate: { $gte: now }
        }).sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: announcements.length,
            data: announcements
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete announcement
// @route   DELETE /api/announcements/:id
// @access  Private (Admin)
exports.deleteAnnouncement = async (req, res, next) => {
    try {
        const announcement = await Announcement.findById(req.params.id);

        if (!announcement) {
            return res.status(404).json({
                success: false,
                message: 'Announcement not found'
            });
        }

        await announcement.deleteOne();

        res.status(200).json({
            success: true,
            data: {}
        });
    } catch (error) {
        next(error);
    }
};
