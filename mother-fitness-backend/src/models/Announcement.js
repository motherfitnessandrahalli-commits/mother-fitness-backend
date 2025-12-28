const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    message: {
        type: String,
        required: true
    },
    active: {
        type: Boolean,
        default: true,
        index: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    isDeleted: {
        type: Boolean,
        default: false
    },
    startDate: {
        type: Date,
        default: Date.now
    },
    endDate: {
        type: Date,
        default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // Default 30 days
    },
    type: {
        type: String,
        enum: ['info', 'important', 'offer', 'event', 'maintenance'],
        default: 'info'
    },
    createdBy: {
        type: String,
        default: 'admin'
    },
    syncStatus: {
        type: String,
        enum: ['PENDING', 'SYNCED'],
        default: 'PENDING'
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Announcement', announcementSchema);
