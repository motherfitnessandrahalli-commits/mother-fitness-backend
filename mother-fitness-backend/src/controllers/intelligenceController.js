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

const AlertService = require('../services/AlertService');

/**
 * @desc    Get Business Intelligence Metrics (Business Health Score, Churn Risk, etc.)
 * @route   GET /api/intelligence/business-health
 */
const getBusinessHealth = asyncHandler(async (req, res, next) => {
    // 1. Basic Stats
    const totalCustomers = await Customer.countDocuments();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const activeCustomers = await Customer.find({ validity: { $gte: today } });
    const activeCustomersCount = activeCustomers.length;

    // 2. Churn Risk (Members who haven't visited in 10+ days) - Basic rule
    const tenDaysAgo = new Date();
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

    // 3. AGI Rule-Based Alerts (Attention List)
    const attentionList = [];

    for (const customer of activeCustomers) {
        // Attendance Drop Alert
        const attAlert = await AlertService.calculateAttendanceDrop(customer._id);
        if (attAlert) {
            attentionList.push({
                memberId: customer.memberId,
                name: customer.name,
                issue: 'Attendance Drop',
                detail: attAlert.message,
                severity: attAlert.severity,
                action: attAlert.suggestedAction
            });
        }

        // Duration Drop Alert
        if (!attAlert) { // Avoid double flagging if attendance already dropped significantly
            const durAlert = await AlertService.calculateDurationDrop(customer._id);
            if (durAlert) {
                attentionList.push({
                    memberId: customer.memberId,
                    name: customer.name,
                    issue: 'Motivation Risk',
                    detail: durAlert.message,
                    severity: durAlert.severity,
                    action: durAlert.suggestedAction
                });
            }
        }
    }

    // 4. Revenue Leakage (Expired members still visiting)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const revenueLeakageMembers = await Customer.aggregate([
        { $match: { validity: { $lt: today } } },
        {
            $lookup: {
                from: 'attendances',
                localField: '_id',
                foreignField: 'customerId',
                as: 'recentVisits',
                pipeline: [{ $match: { timestamp: { $gte: sevenDaysAgo } } }]
            }
        },
        { $match: { 'recentVisits.0': { $exists: true } } },
        {
            $project: {
                name: 1, phone: 1, memberId: 1, validity: 1,
                visitCount: { $size: '$recentVisits' }
            }
        }
    ]);

    // Add leakage to attention list
    revenueLeakageMembers.forEach(m => {
        attentionList.push({
            memberId: m.memberId,
            name: m.name,
            issue: 'Revenue Leakage',
            detail: `Expired member visited ${m.visitCount} times this week`,
            severity: 'CRITICAL',
            action: 'Renew membership immediately'
        });
    });

    // 5. Gym Health Score
    const activeVisitorsIds = await Attendance.distinct('customerId', {
        timestamp: { $gte: sevenDaysAgo }
    });

    const activeVisitorsCount = await Customer.countDocuments({
        _id: { $in: activeVisitorsIds },
        validity: { $gte: today }
    });

    const utilizationRate = activeCustomersCount > 0
        ? Math.min(Math.round((activeVisitorsCount / activeCustomersCount) * 100), 100)
        : 0;

    let healthStatus = 'Healthy';
    if (utilizationRate < 40) healthStatus = 'Action Required';
    else if (utilizationRate < 60) healthStatus = 'Attention Needed';

    sendSuccess(res, 200, {
        health: {
            score: utilizationRate,
            status: healthStatus,
            activeMembers: activeCustomersCount,
            totalMembers: totalCustomers,
            activeVisitors: activeVisitorsCount
        },
        attentionList: attentionList.sort((a, b) => {
            // Sort by severity: CRITICAL > WARNING > WATCH
            const order = { 'CRITICAL': 0, 'WARNING': 1, 'WATCH': 2 };
            return order[a.severity] - order[b.severity];
        }),
        risks: {
            churnCount: attentionList.filter(a => a.issue === 'Attendance Drop').length,
            leakageCount: revenueLeakageMembers.length,
            churnMembers: attentionList.filter(a => a.issue === 'Attendance Drop').map(a => ({
                name: a.name,
                lastVisit: null // Detail would be in the alert message
            }))
        }
    });
});

module.exports = {
    getMemberTimeline,
    getBusinessHealth
};
