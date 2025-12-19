const { Customer, Attendance, TimelineEvent, Payment } = require('../models');
const { asyncHandler, sendSuccess, AppError } = require('../utils/errorHandler');
const timelineService = require('../services/TimelineService');

/**
 * @desc    Get timeline for a specific member
 * @route   GET /api/intelligence/timeline/:customerId
 */
const getMemberTimeline = asyncHandler(async (req, res, next) => {
    const { customerId } = req.params;
    const { limit = 50 } = req.query;

    const timeline = await timelineService.getTimeline(customerId, parseInt(limit));
    sendSuccess(res, 200, { timeline });
});

/**
 * @desc    Get Business Intelligence Metrics (Business Health Score, Churn Risk, etc.)
 * @route   GET /api/intelligence/business-health
 */
const getBusinessHealth = asyncHandler(async (req, res, next) => {
    // 1. Basic Stats
    const totalCustomers = await Customer.countDocuments();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const activeCustomersCount = await Customer.countDocuments({ validity: { $gte: today } });

    // 2. Churn Risk (Members who haven't visited in 10+ days)
    const tenDaysAgo = new Date();
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

    // Find customers with active plan but no attendance in 10 days
    // This requires aggregation
    const churnRiskMembers = await Customer.aggregate([
        {
            $match: {
                validity: { $gte: today } // Active plan
            }
        },
        {
            $lookup: {
                from: 'attendances',
                localField: '_id',
                foreignField: customerId,
                as: 'visits'
            }
        },
        {
            $addFields: {
                lastVisit: { $max: '$visits.createdAt' }
            }
        },
        {
            $match: {
                $or: [
                    { lastVisit: { $lt: tenDaysAgo } },
                    { lastVisit: { $exists: false } } // Never visited but has plan
                ]
            }
        },
        {
            $project: {
                name: 1,
                phone: 1,
                lastVisit: 1,
                plan: 1
            }
        },
        { $limit: 20 }
    ]);

    // 3. Revenue Leakage (Recent Denied Entries)
    const recentDenied = await TimelineEvent.countDocuments({
        type: 'DENIED',
        timestamp: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Last 7 days
    });

    // 4. Gym Health Score (Simple % of active members actually using the gym)
    // Find members who visited in last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const activeVisitorsCount = await Attendance.distinct('customerId', {
        createdAt: { $gte: sevenDaysAgo }
    });

    const utilizationRate = activeCustomersCount > 0
        ? Math.round((activeVisitorsCount.length / activeCustomersCount) * 100)
        : 0;

    let healthStatus = 'GOOD';
    if (utilizationRate < 40) healthStatus = 'CRITICAL';
    else if (utilizationRate < 60) healthStatus = 'NEEDS ATTENTION';

    sendSuccess(res, 200, {
        health: {
            score: utilizationRate,
            status: healthStatus,
            activeMembers: activeCustomersCount,
            totalMembers: totalCustomers
        },
        risks: {
            churnCount: churnRiskMembers.length,
            churnMembers: churnRiskMembers,
            leakageCount: recentDenied
        }
    });
});

module.exports = {
    getMemberTimeline,
    getBusinessHealth
};
