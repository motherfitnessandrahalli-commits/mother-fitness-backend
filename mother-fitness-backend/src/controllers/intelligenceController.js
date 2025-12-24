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
    const churnRiskMembers = await Customer.aggregate([
        {
            $match: {
                validity: { $gte: today } // Active plan only
            }
        },
        {
            $lookup: {
                from: 'attendances',
                localField: '_id',
                foreignField: 'customerId',
                as: 'visits'
            }
        },
        {
            $addFields: {
                // Use timestamp instead of createdAt
                lastVisit: { $max: '$visits.timestamp' }
            }
        },
        {
            $match: {
                $or: [
                    { lastVisit: { $lt: tenDaysAgo } },
                    { lastVisit: { $exists: false } }, // Never visited but has plan
                    { lastVisit: null } // No visits array
                ]
            }
        },
        {
            $project: {
                name: 1,
                phone: 1,
                lastVisit: 1,
                plan: 1,
                memberId: 1
            }
        },
        { $limit: 20 }
    ]);

    // 3. Revenue Leakage (Expired members still visiting)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Find expired members who have recent visits
    const revenueLeakageMembers = await Customer.aggregate([
        {
            $match: {
                validity: { $lt: today } // Expired members
            }
        },
        {
            $lookup: {
                from: 'attendances',
                localField: '_id',
                foreignField: 'customerId',
                as: 'recentVisits',
                pipeline: [
                    {
                        $match: {
                            timestamp: { $gte: sevenDaysAgo }
                        }
                    }
                ]
            }
        },
        {
            $match: {
                'recentVisits.0': { $exists: true } // Has at least one recent visit
            }
        },
        {
            $project: {
                name: 1,
                phone: 1,
                memberId: 1,
                validity: 1,
                visitCount: { $size: '$recentVisits' }
            }
        },
        { $limit: 20 }
    ]);

    // 4. Gym Health Score (% of active members actually using the gym)
    // Find members who visited in last 7 days
    const activeVisitorsIds = await Attendance.distinct('customerId', {
        timestamp: { $gte: sevenDaysAgo }
    });

    // Count how many of these visitors are ACTIVE members
    const activeVisitorsCount = await Customer.countDocuments({
        _id: { $in: activeVisitorsIds },
        validity: { $gte: today } // Only count active members
    });

    // Calculate utilization rate: active visitors / total active members
    const utilizationRate = activeCustomersCount > 0
        ? Math.min(Math.round((activeVisitorsCount / activeCustomersCount) * 100), 100)
        : 0;

    let healthStatus = 'GOOD';
    if (utilizationRate < 40) healthStatus = 'CRITICAL';
    else if (utilizationRate < 60) healthStatus = 'NEEDS ATTENTION';

    sendSuccess(res, 200, {
        health: {
            score: utilizationRate,
            status: healthStatus,
            activeMembers: activeCustomersCount,
            totalMembers: totalCustomers,
            activeVisitors: activeVisitorsCount
        },
        risks: {
            churnCount: churnRiskMembers.length,
            churnMembers: churnRiskMembers,
            leakageCount: revenueLeakageMembers.length,
            leakageMembers: revenueLeakageMembers
        }
    });
});

module.exports = {
    getMemberTimeline,
    getBusinessHealth
};
