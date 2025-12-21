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
    const filter = { _id: data._id };
    const options = { upsert: true, new: true, setDefaultsOnInsert: true };

    try {
        switch (type) {
            case 'customer':
                // For customers, don't trigger pre-save password hashing if it's already hashed
                // But in this sync model, we are mostly just mirroring data
                result = await Customer.findOneAndUpdate(filter, data, options);
                break;

            case 'attendance':
                result = await Attendance.findOneAndUpdate(filter, data, options);
                break;

            case 'payment':
                result = await Payment.findOneAndUpdate(filter, data, options);
                break;

            default:
                return next(new AppError('Invalid sync type', 400));
        }

        logger.info(`Synced ${type}: ${data._id}`);
        sendSuccess(res, 200, result, `Successfully synced ${type}`);
    } catch (error) {
        logger.error(`Sync error for ${type}: ${error.message}`);
        return next(new AppError(`Sync failed: ${error.message}`, 500));
    }
});

module.exports = {
    syncData
};
