const mongoose = require('mongoose');

const adminProfileSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        default: 'Mahesh P'
    },
    photo: {
        type: String,
        default: ''
    },
    dateOfBirth: {
        type: String,
        default: 'October 1990'
    },
    gymStartedYear: {
        type: Number,
        default: 2017
    },
    memberIds: {
        type: [String],
        default: [],
        validate: {
            validator: function (v) {
                return v.length <= 4;
            },
            message: 'Cannot store more than 4 member IDs'
        }
    }
}, {
    timestamps: true
});

// Ensure only one admin profile exists
adminProfileSchema.statics.getSingleton = async function () {
    let profile = await this.findOne();
    if (!profile) {
        profile = await this.create({});
    }
    return profile;
};

module.exports = mongoose.model('AdminProfile', adminProfileSchema);
