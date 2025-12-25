const { Customer, Attendance, Payment } = require('../models');
const { generateToken } = require('../utils/jwt');
const { AppError, asyncHandler, sendSuccess } = require('../utils/errorHandler');
const { generatePaymentReceipt } = require('../utils/pdfGenerator');

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
    console.log(`[Login] Attempting password verify for: ${upperMemberId}`);
    const isMatch = await customer.comparePassword(password);
    console.log(`[Login] Password match result for ${upperMemberId}: ${isMatch}`);

    if (!isMatch) {
        return next(new AppError('Invalid member ID or password', 401));
    }

    // Update last login
    customer.lastLogin = new Date();
    await customer.save();

    // Generate JWT token
    const token = generateToken(customer._id);

    // Remove password from response
    customer.password = undefined;

    sendSuccess(res, 200, {
        customer,
        token,
        isFirstLogin: customer.isFirstLogin,
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

    // Update password and first login flag
    customer.password = newPassword;
    customer.isFirstLogin = false;
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

    const attendance = await Attendance.find({ customerId: req.user.id })
        .sort({ timestamp: -1 })
        .limit(parseInt(limit))
        .skip(skip);

    const total = await Attendance.countDocuments({ customerId: req.user.id });

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

    console.log(`[MemberPayments] Fetching for user: ${req.user.id}`);

    // Explicitly cast to ObjectId to ensure query matches DB type
    const mongoose = require('mongoose');
    const userId = new mongoose.Types.ObjectId(req.user.id);

    // Debug: Check if payments exist for this ID directly
    const verifyCount = await Payment.countDocuments({ customerId: userId });
    console.log(`[MemberPayments] Found ${verifyCount} payments in DB for this user`);

    const payments = await Payment.find({ customerId: userId })
        .sort({ paymentDate: -1 })
        .limit(parseInt(limit))
        .skip(skip);

    const total = await Payment.countDocuments({ customerId: userId });

    sendSuccess(res, 200, {
        payments,
        total,
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        debug_version: 'v3_debug_ids',
        queriedId: userId,
        dbCount: verifyCount
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

    const customer = await Customer.findById(req.user.id);
    if (!customer) {
        return next(new AppError('Member not found', 404));
    }

    // Store push subscription (you'll need to add this field to Customer model if needed)
    // For now, just acknowledge
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

    const BADGE_MILESTONES = {
        'Bronze': 10,
        'Silver': 30,
        'Gold': 60,
        'Beast Mode': 120
    };

    const badgeOrder = ['Bronze', 'Silver', 'Gold', 'Beast Mode'];

    // Find next badge to unlock
    let nextBadge = null;
    let progress = 0;

    for (const badge of badgeOrder) {
        if (!customer.badgesEarned.includes(badge)) {
            nextBadge = {
                name: badge,
                visitsRequired: BADGE_MILESTONES[badge],
                visitsRemaining: BADGE_MILESTONES[badge] - customer.totalVisits
            };
            progress = Math.min(100, (customer.totalVisits / BADGE_MILESTONES[badge]) * 100);
            break;
        }
    }

    sendSuccess(res, 200, {
        totalVisits: customer.totalVisits,
        badgesEarned: customer.badgesEarned,
        nextBadge,
        progress: Math.round(progress)
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

    // Format dates as YYYY-MM-DD for comparison
    const formatDate = (date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    const monthStartStr = formatDate(monthStart);
    const monthEndStr = formatDate(monthEnd);

    // Get attendance records for current month
    const monthlyAttendance = await Attendance.find({
        customerId: req.user.id,
        date: { $gte: monthStartStr, $lte: monthEndStr }
    }).sort({ date: -1 });

    const totalCheckIns = monthlyAttendance.length;
    const daysMissed = totalDaysInMonth - totalCheckIns;

    // Calculate current streak (consecutive days without breaks)
    let currentStreak = 0;

    if (monthlyAttendance.length > 0) {
        const attendanceDates = monthlyAttendance.map(a => new Date(a.date));
        attendanceDates.sort((a, b) => b - a); // Sort descending

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Check if last attendance was today or yesterday
        const lastAttendance = new Date(attendanceDates[0]);
        lastAttendance.setHours(0, 0, 0, 0);

        const daysSinceLastVisit = Math.floor((today - lastAttendance) / (1000 * 60 * 60 * 24));

        if (daysSinceLastVisit <= 1) {
            // Count consecutive days
            let checkDate = new Date(lastAttendance);

            for (const attendanceDate of attendanceDates) {
                const attDate = new Date(attendanceDate);
                attDate.setHours(0, 0, 0, 0);

                if (attDate.getTime() === checkDate.getTime()) {
                    currentStreak++;
                    checkDate.setDate(checkDate.getDate() - 1);
                } else {
                    // Check if there's a gap
                    const expectedDate = new Date(checkDate);
                    const diff = Math.floor((checkDate - attDate) / (1000 * 60 * 60 * 24));

                    if (diff > 0) {
                        break; // Gap found, streak ends
                    }
                }
            }
        }
    }

    // Get month name
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
    const monthName = `${monthNames[month]} ${year}`;

    sendSuccess(res, 200, {
        month: monthName,
        totalCheckIns,
        totalDaysInMonth,
        daysMissed,
        currentStreak,
        lastCheckIn: monthlyAttendance.length > 0 ? monthlyAttendance[0].date : null
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
    const payment = await Payment.findById(paymentId);
    if (!payment) {
        return next(new AppError('Payment not found', 404));
    }

    // Verify payment belongs to this member
    if (payment.customerId.toString() !== req.user.id) {
        return next(new AppError('Unauthorized access to this payment', 403));
    }

    // Find customer details
    const customer = await Customer.findById(req.user.id);
    if (!customer) {
        return next(new AppError('Customer not found', 404));
    }

    // Generate PDF
    const pdfDoc = generatePaymentReceipt(payment, customer);

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=receipt-${payment._id}.pdf`);

    // Stream PDF to response
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
