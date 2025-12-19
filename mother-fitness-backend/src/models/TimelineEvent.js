const mongoose = require('mongoose');

const timelineEventSchema = new mongoose.Schema({
    customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
        required: true,
        index: true
    },
    type: {
        type: String,
        enum: ['JOINED', 'RENEWED', 'CHECK_IN', 'DENIED', 'BADGE_EARNED', 'PAYMENT', 'PLAN_EXPIRED', 'NOTES_ADDED'],
        required: true
    },
    title: {
        type: String,
        required: true
    },
    details: {
        type: String,
        default: ''
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    }
}, {
    timestamps: true
});

// Indexes for common queries
timelineEventSchema.index({ customerId: 1, timestamp: -1 });

const TimelineEvent = mongoose.model('TimelineEvent', timelineEventSchema);

module.exports = TimelineEvent;
