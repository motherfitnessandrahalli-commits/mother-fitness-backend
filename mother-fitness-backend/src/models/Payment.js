const mongoose = require('mongoose');
const CloudSyncService = require('../services/CloudSyncService');

const paymentSchema = new mongoose.Schema({
    paymentId: {
        type: String,
        unique: true,
        required: true
    },
    memberId: {
        type: String,
        required: true,
        index: true
    },
    receiptNumber: {
        type: String,
        unique: true,
        sparse: true // Allow nulls for old records
    },

    amount: {
        type: Number,
        required: true,
        min: 0
    },
    method: {
        type: String,
        enum: ['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'OTHER'],
        default: 'CASH'
    },
    transactionRef: {
        type: String,
        default: ''
    },

    receivedBy: {
        type: String,
        default: 'admin' // Or ObjectId ref if strictly needed, but spec says "admin" string example
    },
    paymentDate: {
        type: Date,
        default: Date.now,
        index: true
    },

    syncStatus: {
        type: String,
        enum: ['PENDING', 'SYNCED'],
        default: 'PENDING'
    }
}, {
    timestamps: true // createdAt, updatedAt
});

// Auto-generate Payment ID
paymentSchema.pre('validate', function (next) {
    if (!this.paymentId) {
        // PAY_YYYYMMDD_Random
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const random = Math.random().toString(36).substr(2, 5).toUpperCase();
        this.paymentId = `PAY_${dateStr}_${random}`;
    }
    next();
});

// Cloud Sync Hook
paymentSchema.post('save', function (doc) {
    // Also trigger recalculatePaymentSummary(doc.memberId) logic here? 
    // The user said "After every payment insert, call recalculatePaymentSummary". 
    // I will add that call in the controller or a separate service to avoid circular deps in models.
    CloudSyncService.syncRecord('payment', doc);
});

module.exports = mongoose.model('Payment', paymentSchema);
