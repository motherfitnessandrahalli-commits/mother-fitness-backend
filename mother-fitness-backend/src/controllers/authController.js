const { User } = require('../models');
const { generateToken } = require('../utils/jwt');
const { AppError, asyncHandler, sendSuccess } = require('../utils/errorHandler');

/**
 * @desc    Register user
 * @route   POST /api/auth/register
 * @access  Public
 */
const register = asyncHandler(async (req, res, next) => {
    const { name, email, password, role } = req.body;

    // Check if user already exists
    const userExists = await User.findOne({ email });
    if (userExists) {
        return next(new AppError('Email already registered', 400));
    }

    // Create user
    const user = await User.create({
        name,
        email,
        password,
        role: role || 'staff', // Default to staff if not specified
    });

    // Generate token
    const token = generateToken(user._id);

    sendSuccess(res, 201, {
        user,
        token,
    }, 'User registered successfully');
});

/**
 * @desc    Login user
 * @route   POST /api/auth/login
 * @access  Public
 */
const login = asyncHandler(async (req, res, next) => {
    const { email, password } = req.body;

    // Validate email & password
    if (!email || !password) {
        return next(new AppError('Please provide email and password', 400));
    }

    // Check for user
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
        return next(new AppError('Invalid credentials', 401));
    }

    // Check if password matches
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
        return next(new AppError('Invalid credentials', 401));
    }

    // Check if active
    if (!user.isActive) {
        return next(new AppError('Account is deactivated', 403));
    }

    // Generate token
    const token = generateToken(user._id);

    // Remove password from output
    user.password = undefined;

    sendSuccess(res, 200, {
        user,
        token,
    }, 'Logged in successfully');
});

/**
 * @desc    Get current logged in user
 * @route   GET /api/auth/me
 * @access  Private
 */
const getMe = asyncHandler(async (req, res, next) => {
    const user = await User.findById(req.user.id);

    sendSuccess(res, 200, {
        user,
    });
});

/**
 * @desc    Change password
 * @route   PUT /api/auth/change-password
 * @access  Private
 */
const changePassword = asyncHandler(async (req, res, next) => {
    const { currentPassword, newPassword } = req.body;

    // Get user with password
    const user = await User.findById(req.user.id).select('+password');

    // Check current password
    if (!(await user.comparePassword(currentPassword))) {
        return next(new AppError('Incorrect current password', 401));
    }

    // Update password
    user.password = newPassword;
    await user.save();

    // Generate new token
    const token = generateToken(user._id);

    sendSuccess(res, 200, {
        token,
    }, 'Password updated successfully');
});

module.exports = {
    register,
    login,
    getMe,
    changePassword,
};
