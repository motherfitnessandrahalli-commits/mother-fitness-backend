const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const CloudSyncService = require('../services/CloudSyncService');

const customerSchema = new mongoose.Schema({
    customerId: {
        type: String,
        unique: true,
        // Not required here because it's auto-generated in pre-save hook
    },
    name: {
        type: String,
        required: [true, 'Customer name is required'],
        trim: true,
    },
    age: {
        type: Number,
        required: [true, 'Age is required'],
        min: [10, 'Age must be at least 10'],
        max: [120, 'Age must be less than 120'],
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        trim: true,
        lowercase: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email'],
    },
    phone: {
        type: String,
        required: [true, 'Phone number is required'],
        trim: true,
    },
    plan: {
        type: String,
        required: [true, 'Plan type is required'],
        enum: {
            values: ['Monthly', 'Quarterly', 'Half-Yearly', 'Yearly'],
            message: '{VALUE} is not a valid plan type',
        },
    },
    validity: {
        type: Date,
        required: [true, 'Plan validity date is required'],
    },
    notes: {
        type: String,
        trim: true,
        default: '',
    },
    photo: {
        type: String,
        default: '',
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    // Member authentication fields
    memberId: {
        type: String,
        unique: true,
        sparse: true, // Allows null values but enforces uniqueness when present
        trim: true,
    },
    password: {
        type: String,
        select: false, // Don't return password by default
        minlength: [4, 'Password must be at least 4 characters'],
    },
    isFirstLogin: {
        type: Boolean,
        default: true,
    },
    lastLogin: {
        type: Date,
    },
    // Achievement Badges
    totalVisits: {
        type: Number,
        default: 0,
    },
    balance: {
        type: Number,
        default: 0,
    },
    badgesEarned: {
        type: [String],
        default: [],
        enum: ['Bronze', 'Silver', 'Gold', 'Beast Mode'],
    },
    // Real-time status
    isInside: {
        type: Boolean,
        default: false,
    },
    lastActivity: {
        type: Date,
    },
}, {
    timestamps: true,
});

// Virtual field for status (computed based on validity)
customerSchema.virtual('status').get(function () {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const validityDate = new Date(this.validity);
    validityDate.setHours(0, 0, 0, 0);

    const diffTime = validityDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
        return 'expired';
    } else if (diffDays <= 7) {
        return 'expiring';
    } else {
        return 'active';
    }
});

// Virtual field for days remaining
customerSchema.virtual('daysRemaining').get(function () {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const validityDate = new Date(this.validity);
    validityDate.setHours(0, 0, 0, 0);

    const diffTime = validityDate - today;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Ensure virtuals are included in JSON
customerSchema.set('toJSON', { virtuals: true });
customerSchema.set('toObject', { virtuals: true });

// Hash password before saving (only if password is modified)
customerSchema.pre('save', async function (next) {
    // Skip if password is not modified
    if (!this.isModified('password') || !this.password) {
        return next();
    }

    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Method to compare password
customerSchema.methods.comparePassword = async function (candidatePassword) {
    try {
        return await bcrypt.compare(candidatePassword, this.password);
    } catch (error) {
        throw new Error('Password comparison failed');
    }
};

// Generate unique customer ID and Member ID before saving
customerSchema.pre('save', async function (next) {
    if (!this.isNew) {
        return next();
    }

    try {
        // Generate internal customerId
        this.customerId = 'cust_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

        // Auto-generate Member ID (U001, U002, etc.) if not provided
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

        // Set default password if not provided
        if (!this.password) {
            this.password = '0000'; // Default member password
        }

        next();
    } catch (error) {
        next(error);
    }
});

// Indexes for faster queries
customerSchema.index({ customerId: 1 });
customerSchema.index({ email: 1 });
customerSchema.index({ phone: 1 });
customerSchema.index({ validity: 1 });
customerSchema.index({ createdAt: -1 });
customerSchema.index({ memberId: 1 });

// Cloud Sync Hook
customerSchema.post('save', function (doc) {
    CloudSyncService.syncRecord('customer', doc);
});

const Customer = mongoose.model('Customer', customerSchema);

module.exports = Customer;
