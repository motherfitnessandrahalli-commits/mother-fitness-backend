const { Customer, Attendance, Payment } = require('../models');
const { sendSuccess, AppError, asyncHandler } = require('../utils/errorHandler');
const logger = require('../config/logger');

/**
 * Handle sync requests from local server
 */
const syncData = asyncHandler(async (req, res, next) => {
    const { type } = req.params;
    const data = req.body;
    const syncKey = req.headers['x-sync-key'];

    // Verify sync key for security
    if (!syncKey || syncKey !== process.env.SYNC_KEY) {
        logger.warn(`Unauthorized sync attempt from IP: ${req.ip}`);
        return next(new AppError('Unauthorized sync', 401));
    }

    let result;
    const options = { upsert: true, new: true, setDefaultsOnInsert: true };
    const dataId = data._id;

    try {
        switch (type) {
            case 'customer': {
                // Try finding by memberId first, then cloudId, then _id
                const searchFilter = {
                    $or: [
                        { memberId: data.memberId },
                        { customerId: data.customerId },
                        { _id: dataId }
                    ]
                };
                result = await Customer.findOneAndUpdate(searchFilter, data, options);
                break;
            }

            case 'attendance': {
                const searchFilter = {
                    $or: [
                        { attendanceId: data.attendanceId },
                        { _id: dataId }
                    ]
                };
                result = await Attendance.findOneAndUpdate(searchFilter, data, options);
                break;
            }

            case 'payment': {
                const searchFilter = {
                    $or: [
                        { paymentId: data.paymentId },
                        { _id: dataId }
                    ]
                };
                result = await Payment.findOneAndUpdate(searchFilter, data, options);
                break;
            }

            default:
                return next(new AppError('Invalid sync type', 400));
        }

        logger.info(`Synced ${type}: ${data._id}`);
        sendSuccess(res, 200, result, `Successfully synced ${type}`);
    } catch (error) {
        // If it's a duplicate key error, we consider it "synced" (it already exists in some form)
        // to prevent blocking the entire sync queue for other important data like Customer login
        if (error.code === 11000 || error.message.includes('E11000')) {
            logger.warn(`Sync duplicate key caught for ${type} (${data._id}): ${error.message}`);
            return sendSuccess(res, 200, { duplicated: true }, `Already exists, skipping duplicate`);
        }

        logger.error(`Sync error for ${type}: ${error.message}`);
        return next(new AppError(`Sync failed: ${error.message}`, 500));
    }
});

module.exports = {
    syncData
};
