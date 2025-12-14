const jwt = require('jsonwebtoken');
const { User, Customer } = require('../models');
const { AppError, asyncHandler } = require('../utils/errorHandler');

/**
 * Protect routes - Verify JWT token
 */
const protect = asyncHandler(async (req, res, next) => {
    let token;

    // Check for token in Authorization header
    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
    ) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
        return next(new AppError('Not authorized to access this route', 401));
    }

    try {
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Check if user still exists
        // Check if user exists in User collection
        let user = await User.findById(decoded.id);
        let userType = 'user';

        // If not found in User, check Customer collection (for members)
        if (!user) {
            user = await Customer.findById(decoded.id);
            userType = 'member';
        }

        if (!user) {
            return next(new AppError('The user belonging to this token no longer exists', 401));
        }

        // Check if user is active (only for staff/admin users)
        if (userType === 'user' && !user.isActive) {
            return next(new AppError('User account is deactivated', 403));
        }

        // Grant access to protected route
        req.user = user;
        req.userType = userType;
        next();
    } catch (error) {
        return next(new AppError('Not authorized to access this route', 401));
    }
});

/**
 * Restrict to specific roles
 * @param {...string} roles - Allowed roles
 */
const restrictTo = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return next(new AppError('You do not have permission to perform this action', 403));
        }
        next();
    };
};

module.exports = {
    protect,
    restrictTo,
};
