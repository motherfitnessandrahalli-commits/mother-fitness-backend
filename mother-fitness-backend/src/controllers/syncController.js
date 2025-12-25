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
        // Remove _id from data to prevent "immutable field" errors when syncing to existing records
        // with different _id values.
        const { _id, ...updateData } = data;

        const updateOptions = { upsert: true };

        switch (type) {
            case 'customer': {
                // Try finding by memberId first, then customerId, then _id
                const searchFilter = {
                    $or: [
                        { memberId: data.memberId },
                        { customerId: data.customerId },
                        { _id: dataId }
                    ]
                };
                // Use updateOne with $set to be safer with immutable fields
                result = await Customer.updateOne(searchFilter, { $set: updateData }, updateOptions);
                break;
            }

            case 'attendance': {
                const searchFilter = {
                    $or: [
                        { attendanceId: data.attendanceId },
                        { _id: dataId }
                    ]
                };
                result = await Attendance.updateOne(searchFilter, { $set: updateData }, updateOptions);
                break;
            }

            case 'payment': {
                const searchFilter = {
                    $or: [
                        { paymentId: data.paymentId },
                        { _id: dataId }
                    ]
                };
                result = await Payment.updateOne(searchFilter, { $set: updateData }, updateOptions);
                break;
            }

            default:
                return next(new AppError('Invalid sync type', 400));
        }

        logger.info(`Synced ${type}: ${data._id}`);
        sendSuccess(res, 200, result, `Successfully synced ${type}`);
    } catch (error) {
        // ULTRA-RESILIENT: Catch ALL errors and return 200 to unblock the sync queue
        // This ensures one broken record doesn't stop the whole system (like Member Login)
        logger.error(`🛰️  Sync failure for ${type} (${dataId}): ${error.message}`);

        return sendSuccess(res, 200, {
            error: true,
            message: error.message,
            duplicated: error.code === 11000 || error.message.includes('E11000')
        }, `Sync handled but encountered error: ${error.message}`);
    }
});

module.exports = {
    syncData
};
