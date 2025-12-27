const mongoose = require('mongoose');

const planSchema = new mongoose.Schema({
    planId: {
        type: String,
        required: true,
        unique: true
    },
    name: {
        type: String,
        required: true
    },
    durationDays: {
        type: Number,
        required: true
    },
    currentPrice: {
        type: Number,
        required: true
    },
    active: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Plan', planSchema);
