const { Attendance, Customer } = require('../models');
const { AppError, asyncHandler, sendSuccess } = require('../utils/errorHandler');
const timeline = require('../services/TimelineService');
const { getLocalDateString, getLocalTimeString, paginate, createPaginationMeta } = require('../utils/helpers');

/**
 * @desc    Mark attendance for a customer
 * @route   POST /api/attendance/mark
 * @access  Private
 */
const markAttendance = asyncHandler(async (req, res, next) => {
    const { customerId } = req.body;

    // 1. Find customer
    const customer = await Customer.findById(customerId);
    if (!customer) {
        return next(new AppError('Customer not found', 404));
    }

    // 1.1 Check if plan is expired - REMOVED to allow tracking of expired attempts
    // if (customer.status === 'expired') {
    //    return next(new AppError('Membership expired! Please renew to enter.', 403));
    // }

    // 2. Check if already marked for today
    const todayStr = getLocalDateString();

    const existingAttendance = await Attendance.findOne({
        customerId: customer._id,
        date: todayStr
    });

    if (existingAttendance) {
        return next(new AppError('Attendance already marked for today', 400));
    }

    // 3. Create attendance record
    const attendance = await Attendance.create({
        memberId: customer.memberId,
        customerId: customer._id,
        customerName: customer.name,
        date: todayStr,
        time: getLocalTimeString(),
        direction: 'IN', // Manual marking defaults to IN
        membershipStatus: customer.membershipStatus, // Align with schema's field name
        source: 'MANUAL',
        markedBy: req.user ? req.user.id : null
    });

    // Log check-in event to timeline
    await timeline.logEvent(
        customer._id,
        'CHECK_IN',
        'Checked In',
        `Entered gym at ${attendance.time}. Status: ${customer.status}`
    );

    // 4. Check and award badges
    const BADGE_MILESTONES = {
        'Bronze': 10,
        'Silver': 30,
        'Gold': 60,
        'Beast Mode': 120
    };

    const BADGE_MESSAGES = {
        'Bronze': '10 visits completed — great start! Keep it up! 💪',
        'Silver': '30 gym visits completed — you\'re killing it! 💪🔥',
        'Gold': '60 visits completed — you\'re a fitness champion! 🏆✨',
        'Beast Mode': '120 visits completed! You\'re an absolute BEAST! 👑🔥 You will take yourself in future!'
    };

    // Increment total visits
    customer.totalVisits += 1;

    // Check for new badge
    let badgeEarned = null;
    const badges = ['Bronze', 'Silver', 'Gold', 'Beast Mode'];

    for (const badge of badges) {
        const threshold = BADGE_MILESTONES[badge];
        if (customer.totalVisits >= threshold && !customer.badgesEarned.includes(badge)) {
            customer.badgesEarned.push(badge);
            badgeEarned = {
                showPopup: true,
                badge,
                visits: customer.totalVisits,
                message: BADGE_MESSAGES[badge]
            };

            // Log badge event to timeline
            await timeline.logEvent(
                customer._id,
                'BADGE_EARNED',
                `Earned ${badge} Badge!`,
                BADGE_MESSAGES[badge]
            );
            break;
        }
    }

    await customer.save();

    // Broadcast real-time update
    try {
        const { getIO } = require('../config/socket');
        const io = getIO();
        io.emit('attendance:new', attendance);
        io.emit('dashboard:update', { type: 'attendance' });
    } catch (error) {
        console.error('Socket emit error:', error.message);
    }

    const responseData = { attendance };
    if (badgeEarned) {
        responseData.badgeEarned = badgeEarned;
    }

    sendSuccess(res, 201, responseData, 'Attendance marked successfully');
});

/**
 * @desc    Get attendance records with filtering
 * @route   GET /api/attendance
 * @access  Private
 */
const getAttendance = asyncHandler(async (req, res, next) => {
    const {
        page = 1,
        limit = 10,
        date,
        customerId,
        status
    } = req.query;

    const query = {};

    // --- RETENTION POLICY IMPLEMENTATION ---
    // Automatically delete records older than 90 days (~3 months)
    try {
        const retentionLimitDate = new Date();
        retentionLimitDate.setDate(retentionLimitDate.getDate() - 90);
        const retentionLimitStr = getLocalDateString(retentionLimitDate);

        // Delete records strictly OLDER than the limit
        const result = await Attendance.deleteMany({
            date: { $lt: retentionLimitStr }
        });

        if (result.deletedCount > 0) {
            console.log(`[Retention Policy] Deleted ${result.deletedCount} old attendance records (older than ${retentionLimitStr})`);
        }
    } catch (cleanupError) {
        console.error('[Retention Policy] Cleanup failed (non-critical):', cleanupError);
        // Continue execution to return current data
    }
    // ---------------------------------------

    // Filter by date (default to today if no filters provided? No, show all by default or let frontend decide)
    if (date) {
        query.date = date;
    }

    // Filter by customer
    if (customerId) {
        query.customerId = customerId;
    }

    // Filter by status
    if (status) {
        query.membershipStatus = status;
    }

    const { skip, limit: limitParsed } = paginate(page, limit);

    const attendance = await Attendance.find(query)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limitParsed)
        .populate('markedBy', 'name');

    const total = await Attendance.countDocuments(query);

    sendSuccess(res, 200, {
        attendance,
        pagination: createPaginationMeta(total, page, limitParsed)
    });
});

/**
 * @desc    Get attendance stats
 * @route   GET /api/attendance/stats
 * @access  Private
 */
const getAttendanceStats = asyncHandler(async (req, res, next) => {
    const { date } = req.query;
    const queryDate = date || getLocalDateString();

    // Stats for specific date
    const totalToday = await Attendance.countDocuments({ date: queryDate });
    const activeToday = await Attendance.countDocuments({ date: queryDate, membershipStatus: 'active' });
    const expiredToday = await Attendance.countDocuments({ date: queryDate, membershipStatus: { $in: ['expired', 'expiring'] } });

    // Weekly stats (last 7 days)
    // This requires aggregation or multiple queries. Let's do a simple aggregation.
    // Note: 'date' is stored as string YYYY-MM-DD, so we can sort/group by it.

    // Get last 7 days dates
    const dates = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        dates.push(getLocalDateString(d));
    }

    const weeklyStats = await Attendance.aggregate([
        { $match: { date: { $in: dates } } },
        { $group: { _id: '$date', count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
    ]);

    sendSuccess(res, 200, {
        date: queryDate,
        daily: {
            total: totalToday,
            active: activeToday,
            expired: expiredToday
        },
        weekly: weeklyStats
    });
});

/**
 * @desc    Get customer attendance history
 * @route   GET /api/attendance/customer/:customerId
 * @access  Private
 */
const getCustomerAttendance = asyncHandler(async (req, res, next) => {
    const { customerId } = req.params;

    const attendance = await Attendance.find({ customerId })
        .sort({ timestamp: -1 })
        .limit(30); // Last 30 visits

    sendSuccess(res, 200, { attendance });
});

/**
 * @desc    Get current gym count (members in gym now)
 * @route   GET /api/attendance/current-count
 * @access  Private (Members + Admin)
 */
const getCurrentGymCount = asyncHandler(async (req, res, next) => {
    // Time window: 90 minutes (1.5 hours)
    const TIME_WINDOW_MINUTES = 90;

    // Calculate cutoff time
    const cutoffTime = new Date();
    cutoffTime.setMinutes(cutoffTime.getMinutes() - TIME_WINDOW_MINUTES);

    // Count unique customers who checked in after the cutoff time
    const recentAttendance = await Attendance.aggregate([
        {
            $match: {
                timestamp: { $gte: cutoffTime }
            }
        },
        {
            $group: {
                _id: '$customerId' // Group by customerId to get unique members
            }
        },
        {
            $count: 'count' // Count the unique groups
        }
    ]);

    const count = recentAttendance.length > 0 ? recentAttendance[0].count : 0;

    sendSuccess(res, 200, {
        count,
        timeWindow: TIME_WINDOW_MINUTES,
        timestamp: new Date()
    });
});

module.exports = {
    markAttendance,
    getAttendance,
    getAttendanceStats,
    getCustomerAttendance,
    getCurrentGymCount
};
