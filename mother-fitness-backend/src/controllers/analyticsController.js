const { Customer, Attendance, Payment } = require('../models');
const { asyncHandler, sendSuccess } = require('../utils/errorHandler');

/**
 * @desc    Get dashboard overview stats
 * @route   GET /api/analytics/dashboard
 * @access  Private
 */
const getDashboardStats = asyncHandler(async (req, res, next) => {
    // 1. Customer Stats
    const totalCustomers = await Customer.countDocuments();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    // Active: validity > nextWeek (safe)
    // Expiring: today <= validity <= nextWeek
    // Expired: validity < today

    const activeCustomers = await Customer.countDocuments({ validity: { $gt: nextWeek } });
    const expiringCustomers = await Customer.countDocuments({ validity: { $gte: today, $lte: nextWeek } });
    const expiredCustomers = await Customer.countDocuments({ validity: { $lt: today } });

    // 2. Attendance Stats (Today)
    const todayStr = today.toISOString().split('T')[0];
    const todayAttendance = await Attendance.countDocuments({ date: todayStr });

    // 3. New vs Renewing (Current Month)
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    // New Customers: Created this month
    const newCustomers = await Customer.countDocuments({
        createdAt: { $gte: startOfMonth, $lte: endOfMonth }
    });

    // Renewing Customers: Payments this month from customers created BEFORE this month
    // We count unique customers who made a payment this month
    const renewingPayments = await Payment.aggregate([
        {
            $match: {
                paymentDate: { $gte: startOfMonth, $lte: endOfMonth }
            }
        },
        {
            $lookup: {
                from: 'customers',
                localField: 'customerId',
                foreignField: '_id',
                as: 'customer'
            }
        },
        {
            $unwind: '$customer'
        },
        {
            $match: {
                'customer.createdAt': { $lt: startOfMonth } // Created before this month
            }
        },
        {
            $group: {
                _id: '$customerId'
            }
        },
        {
            $count: 'count'
        }
    ]);

    // If no payments found, result is empty array
    const renewingCount = renewingPayments.length > 0 ? renewingPayments[0].count : 0;

    sendSuccess(res, 200, {
        customers: {
            total: totalCustomers,
            active: activeCustomers,
            expiring: expiringCustomers,
            expired: expiredCustomers,
            newThisMonth: newCustomers,
            renewingThisMonth: renewingCount
        },
        attendance: {
            today: todayAttendance
        }
    });
});

/**
 * @desc    Get plan popularity data
 * @route   GET /api/analytics/plans
 * @access  Private
 */
const getPlanPopularity = asyncHandler(async (req, res, next) => {
    const stats = await Customer.aggregate([
        { $group: { _id: '$plan', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
    ]);

    // Format for Chart.js
    const labels = stats.map(item => item._id);
    const data = stats.map(item => item.count);

    sendSuccess(res, 200, {
        labels,
        data,
        raw: stats
    });
});

/**
 * @desc    Get age demographics
 * @route   GET /api/analytics/demographics
 * @access  Private
 */
const getAgeDemographics = asyncHandler(async (req, res, next) => {
    // Define age ranges: <18, 18-25, 26-35, 36-50, 50+
    const stats = await Customer.aggregate([
        {
            $bucket: {
                groupBy: '$age',
                boundaries: [0, 15, 21, 26, 31, 36, 41, 46, 51, 120],
                default: 'Other',
                output: {
                    count: { $sum: 1 }
                }
            }
        }
    ]);

    // Map bucket IDs to readable labels
    const labelMap = {
        0: 'Under 15',
        15: '15-20',
        21: '21-25',
        26: '26-30',
        31: '31-35',
        36: '36-40',
        41: '41-45',
        46: '46-50',
        51: '50+'
    };

    const formattedStats = stats.map(item => ({
        label: labelMap[item._id] || 'Other',
        count: item.count
    }));

    sendSuccess(res, 200, {
        labels: formattedStats.map(item => item.label),
        data: formattedStats.map(item => item.count),
        raw: formattedStats
    });
});

/**
 * @desc    Get business growth (last 6 months)
 * @route   GET /api/analytics/growth
 * @access  Private
 */
const getBusinessGrowth = asyncHandler(async (req, res, next) => {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5); // Go back 5 months + current month = 6
    sixMonthsAgo.setDate(1); // Start of that month

    const stats = await Customer.aggregate([
        {
            $match: {
                createdAt: { $gte: sixMonthsAgo }
            }
        },
        {
            $group: {
                _id: {
                    month: { $month: '$createdAt' },
                    year: { $year: '$createdAt' }
                },
                count: { $sum: 1 }
            }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Fill in missing months with 0
    const labels = [];
    const data = [];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // Generate last 6 months labels
    for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const monthIndex = d.getMonth();
        const year = d.getFullYear();

        labels.push(`${monthNames[monthIndex]} ${year}`);

        // Find matching stat
        const stat = stats.find(s => s._id.month === (monthIndex + 1) && s._id.year === year);
        data.push(stat ? stat.count : 0);
    }

    sendSuccess(res, 200, {
        labels,
        data,
        raw: stats
    });
});

/**
 * @desc    Get profit metrics (daily, weekly, monthly, yearly)
 * @route   GET /api/analytics/profits
 * @access  Private
 */
const getProfitMetrics = asyncHandler(async (req, res, next) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Daily: Today
    const dailyStart = new Date(today);
    const dailyEnd = new Date(today);
    dailyEnd.setHours(23, 59, 59, 999);

    const dailyProfit = await Payment.aggregate([
        {
            $match: {
                paymentDate: { $gte: dailyStart, $lte: dailyEnd },
                status: { $in: ['completed', 'pending'] }
            }
        },
        {
            $group: {
                _id: null,
                total: { $sum: '$amount' }
            }
        }
    ]);

    // Weekly: Last 7 days
    const weeklyStart = new Date(today);
    weeklyStart.setDate(weeklyStart.getDate() - 6); // Today + last 6 days = 7 days total

    const weeklyProfit = await Payment.aggregate([
        {
            $match: {
                paymentDate: { $gte: weeklyStart, $lte: dailyEnd },
                status: { $in: ['completed', 'pending'] }
            }
        },
        {
            $group: {
                _id: null,
                total: { $sum: '$amount' }
            }
        }
    ]);

    // Monthly: Current month
    const monthlyStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthlyEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);

    const monthlyProfit = await Payment.aggregate([
        {
            $match: {
                paymentDate: { $gte: monthlyStart, $lte: monthlyEnd },
                status: { $in: ['completed', 'pending'] }
            }
        },
        {
            $group: {
                _id: null,
                total: { $sum: '$amount' }
            }
        }
    ]);

    // Yearly: Current year
    const yearlyStart = new Date(today.getFullYear(), 0, 1);
    const yearlyEnd = new Date(today.getFullYear(), 11, 31, 23, 59, 59, 999);

    const yearlyProfit = await Payment.aggregate([
        {
            $match: {
                paymentDate: { $gte: yearlyStart, $lte: yearlyEnd },
                status: { $in: ['completed', 'pending'] }
            }
        },
        {
            $group: {
                _id: null,
                total: { $sum: '$amount' }
            }
        }
    ]);

    sendSuccess(res, 200, {
        daily: dailyProfit.length > 0 ? dailyProfit[0].total : 0,
        weekly: weeklyProfit.length > 0 ? weeklyProfit[0].total : 0,
        monthly: monthlyProfit.length > 0 ? monthlyProfit[0].total : 0,
        yearly: yearlyProfit.length > 0 ? yearlyProfit[0].total : 0
    });
});

module.exports = {
    getDashboardStats,
    getPlanPopularity,
    getAgeDemographics,
    getBusinessGrowth,
    getProfitMetrics
};
