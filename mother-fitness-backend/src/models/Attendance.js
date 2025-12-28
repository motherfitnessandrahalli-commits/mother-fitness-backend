const mongoose = require('mongoose');
const CloudSyncService = require('../services/CloudSyncService');

const attendanceSchema = new mongoose.Schema({
    memberId: {
        type: String,
        required: true,
        index: true
    },
    customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
        index: true
    },
    customerName: {
        type: String,
        trim: true
    },
    timestamp: {
        type: Date,
        required: true,
        default: Date.now,
        index: true
    },
    date: {
        type: String, // YYYY-MM-DD for reporting
        index: true
    },
    time: {
        type: String // HH:MM:SS
    },
    direction: {
        type: String,
        enum: ['IN', 'OUT'],
        required: true,
        default: 'IN'
    },
    membershipStatus: {
        type: String,
        enum: ['active', 'expiring', 'expired', 'ACTIVE', 'EXPIRED', 'EXPIRING', 'SUSPENDED'],
    },
    markedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
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
    },
    attendanceId: {
        type: String,
        unique: true,
        sparse: true
    }
}, {
    timestamps: true
});

// Pre-save: Auto-generate attendanceId
attendanceSchema.pre('save', function (next) {
    if (!this.attendanceId) {
        // Generate a simple unique ID: A + Timestamp + Random
        this.attendanceId = 'A' + Date.now() + Math.floor(Math.random() * 1000);
    }
    next();
});

// Cloud Sync Hook
attendanceSchema.post('save', function (doc) {
    CloudSyncService.syncRecord('attendance', doc);
});

module.exports = mongoose.model('Attendance', attendanceSchema);
