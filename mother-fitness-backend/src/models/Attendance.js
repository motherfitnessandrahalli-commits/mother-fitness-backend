const mongoose = require('mongoose');
const CloudSyncService = require('../services/CloudSyncService');

const attendanceSchema = new mongoose.Schema({
    memberId: {
        type: String,
        required: true,
        index: true
    },
    timestamp: {
        type: Date,
        required: true,
        default: Date.now,
        index: true
    },
    direction: {
        type: String,
        enum: ['IN', 'OUT'],
        required: true
    },
    deviceId: {
        type: String,
        default: 'MANUAL'
    },
    source: {
        type: String,
        enum: ['BIOMETRIC', 'MANUAL', 'APP'],
        default: 'BIOMETRIC'
    },
    syncStatus: {
        type: String,
        enum: ['PENDING', 'SYNCED'],
        default: 'PENDING'
    }
}, {
    timestamps: true
});

// Cloud Sync Hook
attendanceSchema.post('save', function (doc) {
    CloudSyncService.syncRecord('attendance', doc);
});

module.exports = mongoose.model('Attendance', attendanceSchema);
