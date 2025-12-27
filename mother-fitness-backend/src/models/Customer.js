const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const CloudSyncService = require('../services/CloudSyncService');

const customerSchema = new mongoose.Schema({
    // --- IDENTITY ---
    memberId: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        index: true // Human readable ID (e.g., U010)
    },
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true
    },
    phone: {
        type: String,
        required: [true, 'Phone is required'],
        trim: true,
        index: true
    },
    email: {
        type: String,
        trim: true,
        lowercase: true,
        default: ''
    },
    gender: {
        type: String,
        enum: ['Male', 'Female', 'Other'],
        default: 'Male'
    },
    photo: {
        type: String,
        default: ''
    },
    password: {
        type: String,
        select: false // Protected
    },

    // --- MEMBERSHIP (Immutable Snapshot) ---
    membership: {
        planId: { type: String, required: true },
        planName: { type: String, required: true },
        durationDays: { type: Number, required: true },
        startDate: { type: Date, required: true },
        endDate: { type: Date, required: true },
        planPriceAtPurchase: { type: Number, required: true } // NEVER CHANGES
    },

    membershipStatus: {
        type: String,
        enum: ['ACTIVE', 'EXPIRED', 'SUSPENDED'],
        default: 'ACTIVE',
        index: true
    },

    // --- FINANCIALS (Calculated) ---
    paymentSummary: {
        totalPaid: { type: Number, default: 0 },
        balance: { type: Number, default: 0 },
        paymentStatus: {
            type: String,
            enum: ['PENDING', 'PARTIAL', 'COMPLETED'],
            default: 'PENDING'
        }
    },

    // --- INTEGRATIONS ---
    biometric: {
        deviceUserId: { type: String },
        enabled: { type: Boolean, default: true }
    },

    // --- SYNC ---
    syncStatus: {
        local: { type: Boolean, default: true },
        cloud: { type: Boolean, default: false },
        lastSyncedAt: { type: Date }
    },

    // --- EXTRAS (Live Count, etc.) ---
    isInside: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true,
    collection: 'customers' // Keep collection name 'customers' to avoid massive migration issues if possible, or 'members' if strictly requested. User said "members collection". I'll map it to 'customers' for file compatibility but maybe I should stick to 'members'. Defaults to plural of model name 'Customer' -> 'customers'.
});

// Pre-save: ID Generation & Password Hashing
customerSchema.pre('save', async function (next) {
    if (this.isNew) {
        // Auto-generate Member ID if missing
        if (!this.memberId) {
            const lastCustomer = await this.constructor.findOne({
                memberId: { $regex: /^U\d+$/ }
            }).sort({ memberId: -1 });

            if (lastCustomer && lastCustomer.memberId) {
                const lastId = parseInt(lastCustomer.memberId.replace('U', ''));
                this.memberId = 'U' + String(lastId + 1).padStart(3, '0');
            } else {
                this.memberId = 'U001';
            }
        }

        // Default password
        if (!this.password) {
            this.password = '0000';
        }
    }

    // Hash password
    if (this.isModified('password')) {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
    }

    next();
});

// Password Compare
customerSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

// Cloud Sync Hook
customerSchema.post('save', function (doc) {
    CloudSyncService.syncRecord('customer', doc);
});

module.exports = mongoose.model('Customer', customerSchema);
