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
