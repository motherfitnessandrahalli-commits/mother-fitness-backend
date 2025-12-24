const { AdminProfile, User } = require('../models');
const bcrypt = require('bcryptjs');
const { asyncHandler, sendSuccess, AppError } = require('../utils/errorHandler');

/**
 * @desc    Get admin profile (singleton)
 * @route   GET /api/admin-profile
 * @access  Private
 */
const getAdminProfile = asyncHandler(async (req, res, next) => {
    const profile = await AdminProfile.getSingleton();
    sendSuccess(res, 200, profile);
});

/**
 * @desc    Update admin profile
 * @route   PUT /api/admin-profile
 * @access  Private (requires password verification)
 */
const updateAdminProfile = asyncHandler(async (req, res, next) => {
    const { name, photo, dateOfBirth, gymStartedYear, memberIds, password } = req.body;

    // Verify admin password before allowing update
    if (!password) {
        return next(new AppError('Password is required to update admin profile', 400));
    }

    // Get admin user (assuming email is admin@motherfitness.com)
    const adminUser = await User.findOne({ email: 'admin@motherfitness.com' }).select('+password');
    if (!adminUser) {
        return next(new AppError('Admin user not found', 404));
    }

    // Verify password
    const isPasswordCorrect = await bcrypt.compare(password, adminUser.password);
    if (!isPasswordCorrect) {
        return next(new AppError('Incorrect password', 401));
    }

    // Validate member IDs array
    if (memberIds && memberIds.length > 4) {
        return next(new AppError('Cannot store more than 4 member IDs', 400));
    }

    // Update profile
    const profile = await AdminProfile.getSingleton();

    if (name !== undefined) profile.name = name;
    if (photo !== undefined) profile.photo = photo;
    if (dateOfBirth !== undefined) profile.dateOfBirth = dateOfBirth;
    if (gymStartedYear !== undefined) profile.gymStartedYear = gymStartedYear;
    if (memberIds !== undefined) profile.memberIds = memberIds;

    await profile.save();

    sendSuccess(res, 200, profile, 'Admin profile updated successfully');
});

/**
 * @desc    Verify admin password
 * @route   POST /api/admin-profile/verify
 * @access  Private
 */
const verifyPassword = asyncHandler(async (req, res, next) => {
    const { password } = req.body;

    if (!password) {
        return next(new AppError('Password is required', 400));
    }

    const adminUser = await User.findOne({ email: 'admin@motherfitness.com' }).select('+password');

    console.log('🔐 Debug Verification:', {
        found: !!adminUser,
        hasPassword: !!(adminUser && adminUser.password),
        passwordLength: adminUser && adminUser.password ? adminUser.password.length : 0
    });

    if (!adminUser) {
        return next(new AppError('Admin user not found', 404));
    }

    console.log('🔐 Verification Request for:', adminUser.email);
    console.log('🔐 Password Hash Present:', !!adminUser.password);

    if (!adminUser.password) {
        // This specific error proves the code IS updated but the select('+password') failed or data is missing
        return next(new AppError('SERVER ERROR: Admin user found but password hash is missing. Code is updated.', 500));
    }

    const isPasswordCorrect = await bcrypt.compare(password, adminUser.password);
    if (!isPasswordCorrect) {
        return next(new AppError('Incorrect password', 401));
    }

    sendSuccess(res, 200, { verified: true });
});

module.exports = {
    getAdminProfile,
    updateAdminProfile,
    verifyPassword
};
