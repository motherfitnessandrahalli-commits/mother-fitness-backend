const mongoose = require('mongoose');

const syncQueueSchema = new mongoose.Schema({
    entity: {
        type: String,
        required: true,
        enum: ['MEMBER', 'PAYMENT', 'ATTENDANCE', 'ANNOUNCEMENT']
    },
    entityId: {
        type: String,
        required: true
    },
    action: {
        type: String,
        required: true,
        enum: ['UPSERT', 'DELETE'] // 'UPSERT' covers Create & Update
    },
    payload: {
        type: Object,
        required: true
    },
    status: {
        type: String,
        enum: ['PENDING', 'SUCCESS', 'FAILED'],
        default: 'PENDING',
        index: true
    },
    retryCount: {
        type: Number,
        default: 0
    },
    lastAttemptAt: {
        type: Date
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('SyncQueue', syncQueueSchema);
