const mongoose = require('mongoose');

const syncQueueSchema = new mongoose.Schema({
    operation: {
        type: String,
        required: true,
        enum: ['CREATE_MEMBER', 'UPDATE_MEMBER', 'CREATE_PAYMENT', 'UPDATE_PAYMENT', 'create_payment', 'CREATE_ANNOUNCEMENT', 'UPDATE_ANNOUNCEMENT', 'DELETE_ANNOUNCEMENT'] // Standardized codes
    },
    payload: {
        type: Object, // The data to sync (cleaned of heavy fields)
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'failed', 'processing'],
        default: 'pending'
    },
    attempts: {
        type: Number,
        default: 0
    },
    lastError: {
        type: String
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Index to find pending items quickly
syncQueueSchema.index({ status: 1, createdAt: 1 });

module.exports = mongoose.model('SyncQueue', syncQueueSchema);
