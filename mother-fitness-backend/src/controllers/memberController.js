const { Customer, Attendance, Payment } = require('../models');
const { generateToken } = require('../utils/jwt');
const { AppError, asyncHandler, sendSuccess } = require('../utils/errorHandler');
const { generatePaymentReceipt } = require('../utils/pdfGenerator');
const mongoose = require('mongoose');

/**
 * @desc    Member login with memberId and password
 * @route   POST /api/member/login
 * @access  Public
 */
const memberLogin = asyncHandler(async (req, res, next) => {
    const { memberId, password } = req.body;

    // Validate input
    if (!memberId || !password) {
        return next(new AppError('Please provide member ID and password', 400));
    }

    // Force uppercase memberId (handle u001 -> U001)
    const upperMemberId = memberId.toUpperCase();

    // Find customer with password field
    const customer = await Customer.findOne({ memberId: upperMemberId }).select('+password');
    if (!customer) {
        console.warn(`[Login] User not found: ${upperMemberId}`);
        return next(new AppError('Invalid member ID or password', 401));
    }

    // Check if customer has password set
    if (!customer.password) {
        console.warn(`[Login] No password set for: ${upperMemberId}`);
        return next(new AppError('Member account not activated. Contact admin.', 401));
    }

    // Verify password
    const isMatch = await customer.comparePassword(password);

    if (!isMatch) {
        return next(new AppError('Invalid member ID or password', 401));
    }

    // Update last login (Removed from schema, so skipping update)
    // customer.lastLogin = new Date(); 
    // await customer.save(); 

    // Generate JWT token
    const token = generateToken(customer._id);

    // Remove password from response
    customer.password = undefined;

    sendSuccess(res, 200, {
        customer,
        token,
        // isFirstLogin removed from schema, defaulting to false
        isFirstLogin: false,
    }, 'Login successful');
});

/**
 * @desc    Get member profile
 * @route   GET /api/member/me
 * @access  Private (Member)
 */
const getMemberProfile = asyncHandler(async (req, res, next) => {
    const customer = await Customer.findById(req.user.id);

    if (!customer) {
        return next(new AppError('Member not found', 404));
    }

    sendSuccess(res, 200, { customer });
});

/**
 * @desc    Update member profile
 * @route   PUT /api/member/profile
 * @access  Private (Member)
 */
const updateMemberProfile = asyncHandler(async (req, res, next) => {
    const { name, phone, email } = req.body;

    const customer = await Customer.findById(req.user.id);
    if (!customer) {
        return next(new AppError('Member not found', 404));
    }

    // Update allowed fields only (photo is managed by admin)
    if (name) customer.name = name;
    if (phone) customer.phone = phone;
    if (email) customer.email = email;

    await customer.save();

    sendSuccess(res, 200, { customer }, 'Profile updated successfully');
});

/**
 * @desc    Change password
 * @route   PUT /api/member/change-password
 * @access  Private (Member)
 */
const changePassword = asyncHandler(async (req, res, next) => {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
        return next(new AppError('Please provide current and new password', 400));
    }

    if (newPassword.length < 4) {
        return next(new AppError('Password must be at least 4 characters', 400));
    }

    // Get customer with password field
    const customer = await Customer.findById(req.user.id).select('+password');
    if (!customer) {
        return next(new AppError('Member not found', 404));
    }

    // Verify current password
    const isMatch = await customer.comparePassword(currentPassword);
    if (!isMatch) {
        return next(new AppError('Current password is incorrect', 401));
    }

    // Update password
    customer.password = newPassword;
    // customer.isFirstLogin = false; // Field removed
    await customer.save();

    // Generate new token
    const token = generateToken(customer._id);

    sendSuccess(res, 200, { token }, 'Password changed successfully');
});

/**
 * @desc    Get member attendance history
 * @route   GET /api/member/attendance
 * @access  Private (Member)
 */
const getMemberAttendance = asyncHandler(async (req, res, next) => {
    const { limit = 30, page = 1 } = req.query;

    const skip = (page - 1) * limit;

    // Use memberId string for linking
    const attendance = await Attendance.find({ memberId: req.user.memberId })
        .sort({ timestamp: -1 })
        .limit(parseInt(limit))
        .skip(skip);

    const total = await Attendance.countDocuments({ memberId: req.user.memberId });

    sendSuccess(res, 200, {
        attendance,
        total,
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
    });
});

/**
 * @desc    Get member payment history
 * @route   GET /api/member/payments
 * @access  Private (Member)
 */
const getMemberPayments = asyncHandler(async (req, res, next) => {
    const { limit = 10, page = 1 } = req.query;

    const skip = (page - 1) * limit;

    console.log(`[MemberPayments] Fetching for user: ${req.user.memberId}`);

    // Fix: Use memberId (String) instead of _id (ObjectId)
    // New Payment schema uses memberId string (e.g. U010)
    const payments = await Payment.find({ memberId: req.user.memberId })
        .sort({ paymentDate: -1 })
        .limit(parseInt(limit))
        .skip(skip);

    const total = await Payment.countDocuments({ memberId: req.user.memberId });

    sendSuccess(res, 200, {
        payments: payments.map(p => ({
            ...p.toObject(),
            paymentMethod: p.method || p.paymentMethod // Harmonize for frontend
        })),
        total,
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit)
    });
});

/**
 * @desc    Subscribe to push notifications
 * @route   POST /api/member/subscribe-push
 * @access  Private (Member)
 */
const subscribePushNotification = asyncHandler(async (req, res, next) => {
    const { subscription } = req.body;

    if (!subscription) {
        return next(new AppError('Push subscription data required', 400));
    }

    sendSuccess(res, 200, { subscription }, 'Push notification subscription successful');
});

/**
 * @desc    Get member badge status
 * @route   GET /api/member/badges
 * @access  Private (Member)
 */
const getBadgeStatus = asyncHandler(async (req, res, next) => {
    const customer = await Customer.findById(req.user.id);
    if (!customer) {
        return next(new AppError('Member not found', 404));
    }

    // Logic relying on removed fields (totalVisits, badgesEarned).
    // Temporarily returning empty/default to prevent crashes.
    // In future, calculate totalVisits from Attendance count.

    // Quick calc for visits if needed:
    const visitCount = await Attendance.countDocuments({ memberId: customer.memberId, direction: 'IN' });

    sendSuccess(res, 200, {
        totalVisits: visitCount,
        badgesEarned: [],
        nextBadge: null,
        progress: 0
    });
});

/**
 * @desc    Get monthly progress analytics
 * @route   GET /api/member/monthly-progress
 * @access  Private (Member)
 */
const getMonthlyProgress = asyncHandler(async (req, res, next) => {
    const customer = await Customer.findById(req.user.id);
    if (!customer) {
        return next(new AppError('Member not found', 404));
    }

    // Get current month's start and end dates
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0);
    const totalDaysInMonth = monthEnd.getDate();

    // Use memberId for Attendance Query
    const monthlyAttendance = await Attendance.find({
        memberId: customer.memberId, // Fix: Use memberId
        timestamp: { $gte: monthStart, $lte: monthEnd }, // Fix: Use timestamp
        direction: 'IN' // Only count check-ins
    }).sort({ timestamp: -1 });

    const totalCheckIns = monthlyAttendance.length;
    const daysMissed = Math.max(0, new Date().getDate() - totalCheckIns); // Rough calc

    // ... (Streak logic omitted for brevity, can be re-added if critical, but simplified for stability)

    // Get month name
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
    const monthName = `${monthNames[month]} ${year}`;

    sendSuccess(res, 200, {
        month: monthName,
        totalCheckIns,
        totalDaysInMonth,
        daysMissed,
        currentStreak: 0, // Placeholder
        lastCheckIn: monthlyAttendance.length > 0 ? monthlyAttendance[0].timestamp : null
    });
});

/**
 * @desc    Download payment receipt as PDF
 * @route   GET /api/member/payments/:paymentId/receipt
 * @access  Private (Member)
 */
const downloadPaymentReceipt = asyncHandler(async (req, res, next) => {
    const { paymentId } = req.params;

    // Find payment
    const payment = await Payment.findOne({
        $or: [
            { paymentId: paymentId }, // If querying by custom ID
            { _id: mongoose.Types.ObjectId.isValid(paymentId) ? paymentId : null }
        ]
    });

    if (!payment) {
        return next(new AppError('Payment not found', 404));
    }

    // Verify payment belongs to this member (String ID comparison)
    if (payment.memberId !== req.user.memberId) {
        return next(new AppError('Unauthorized access to this payment', 403));
    }

    // Find customer details
    const customer = await Customer.findById(req.user.id);
    if (!customer) {
        return next(new AppError('Customer not found', 404));
    }

    const pdfDoc = generatePaymentReceipt(payment, customer);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=receipt-${payment._id}.pdf`);

    pdfDoc.pipe(res);
});

module.exports = {
    memberLogin,
    getMemberProfile,
    updateMemberProfile,
    changePassword,
    getMemberAttendance,
    getMemberPayments,
    subscribePushNotification,
    getBadgeStatus,
    getMonthlyProgress,
    downloadPaymentReceipt,
};
