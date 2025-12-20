const zktecoService = require('../services/ZKTecoService');
const { Customer, Attendance } = require('../models');
const { asyncHandler, sendSuccess, AppError } = require('../utils/errorHandler');
const { getLocalDateString, getLocalTimeString } = require('../utils/helpers');
const { getIO } = require('../config/socket');
const logger = require('../config/logger');
const timeline = require('../services/TimelineService');

/**
 * @desc    Connect to ZKTeco device
 * @route   POST /api/zkteco/connect
 * @access  Private (Admin)
 */
const connectDevice = asyncHandler(async (req, res, next) => {
    const { ip, port } = req.body;

    if (!ip) {
        return next(new AppError('Device IP address is required', 400));
    }

    const connected = await zktecoService.connect(ip, port);

    if (connected) {
        const status = zktecoService.getStatus();
        sendSuccess(res, 200, status, `Successfully connected to ZKTeco device at ${ip}`);
    } else {
        next(new AppError('Failed to connect to device. Check IP address and network connectivity.', 500));
    }
});

/**
 * @desc    Disconnect from ZKTeco device
 * @route   POST /api/zkteco/disconnect
 * @access  Private (Admin)
 */
const disconnectDevice = asyncHandler(async (req, res, next) => {
    const disconnected = await zktecoService.disconnect();

    if (disconnected) {
        sendSuccess(res, 200, null, 'Successfully disconnected from ZKTeco device');
    } else {
        next(new AppError('Device was not connected', 400));
    }
});

/**
 * @desc    Get device status and info
 * @route   GET /api/zkteco/status
 * @access  Private (Admin)
 */
const getDeviceStatus = asyncHandler(async (req, res, next) => {
    const status = zktecoService.getStatus();

    if (status.connected) {
        const info = await zktecoService.getDeviceInfo();
        sendSuccess(res, 200, { ...status, deviceInfo: info });
    } else {
        sendSuccess(res, 200, status);
    }
});

/**
 * @desc    Enroll a single member to the device
 * @route   POST /api/zkteco/enroll-member
 * @access  Private (Admin)
 */
const enrollMember = asyncHandler(async (req, res, next) => {
    const { customerId } = req.body;

    if (!customerId) {
        return next(new AppError('Customer ID is required', 400));
    }

    // Find customer
    const customer = await Customer.findById(customerId);
    if (!customer) {
        return next(new AppError('Customer not found', 404));
    }

    // Enroll to device using memberId
    const userId = customer.memberId || customer._id.toString();
    await zktecoService.enrollUser(userId, customer.name);

    // Log event
    await timeline.logEvent(
        customer._id,
        'ENROLLMENT',
        'Biometric Enrolled',
        `Enrolled in ZKTeco device with ID: ${userId}`
    );

    sendSuccess(res, 200, { userId }, `Successfully enrolled ${customer.name} to biometric device`);
});

/**
 * @desc    Remove member from device
 * @route   DELETE /api/zkteco/remove-member/:customerId
 * @access  Private (Admin)
 */
const removeMember = asyncHandler(async (req, res, next) => {
    const { customerId } = req.params;

    const customer = await Customer.findById(customerId);
    if (!customer) {
        return next(new AppError('Customer not found', 404));
    }

    const userId = customer.memberId || customer._id.toString();
    await zktecoService.removeUser(userId);

    // Log event
    await timeline.logEvent(
        customer._id,
        'UNENROLLMENT',
        'Biometric Removed',
        `Removed from ZKTeco device`
    );

    sendSuccess(res, 200, null, `Successfully removed ${customer.name} from biometric device`);
});

/**
 * @desc    Sync all active members to device
 * @route   POST /api/zkteco/sync-all-members
 * @access  Private (Admin)
 */
const syncAllMembers = asyncHandler(async (req, res, next) => {
    // Get all active customers
    const customers = await Customer.find({ status: { $in: ['active', 'expiring'] } });

    if (customers.length === 0) {
        return sendSuccess(res, 200, { success: 0, failed: 0 }, 'No active members to sync');
    }

    // Prepare user list
    const users = customers.map(customer => ({
        userId: customer.memberId || customer._id.toString(),
        name: customer.name,
        cardNumber: 0
    }));

    // Bulk enroll
    const results = await zktecoService.bulkEnrollUsers(users);

    sendSuccess(res, 200, results, `Synced ${results.success} members to device`);
});

/**
 * @desc    Get enrolled users from device
 * @route   GET /api/zkteco/enrolled-users
 * @access  Private (Admin)
 */
const getEnrolledUsers = asyncHandler(async (req, res, next) => {
    const users = await zktecoService.getEnrolledUsers();
    sendSuccess(res, 200, { users, count: users.length });
});

/**
 * @desc    Get attendance logs from device
 * @route   GET /api/zkteco/attendance-logs
 * @access  Private (Admin)
 */
const getAttendanceLogs = asyncHandler(async (req, res, next) => {
    const logs = await zktecoService.getAttendanceLogs();
    sendSuccess(res, 200, { logs, count: logs.length });
});

/**
 * @desc    Process attendance event from ZKTeco device
 * @route   POST /api/zkteco/process-attendance
 * @access  Private (System - called internally)
 */
const processAttendance = asyncHandler(async (req, res, next) => {
    const { userId, timestamp } = req.body;

    if (!userId) {
        return next(new AppError('User ID is required', 400));
    }

    // Find customer by memberId or _id
    const customer = await Customer.findOne({
        $or: [
            { memberId: userId },
            { _id: userId }
        ]
    });

    if (!customer) {
        logger.warn(`⚠️ Attendance event for unknown user: ${userId}`);
        return next(new AppError('Member not found', 404));
    }

    const status = customer.status; // Uses virtual field
    const todayStr = getLocalDateString();

    // Check if already marked today
    const alreadyMarked = await Attendance.findOne({
        customerId: customer._id,
        date: todayStr
    });

    if (!alreadyMarked) {
        // Mark attendance
        await Attendance.create({
            customerId: customer._id,
            customerName: customer.name,
            date: todayStr,
            time: getLocalTimeString(),
            membershipStatus: status,
            markedBy: null // System marked
        });

        customer.totalVisits += 1;
        await customer.save();

        // Log to timeline
        await timeline.logEvent(
            customer._id,
            'CHECK_IN',
            'Checked In',
            `Entered gym via ZKTeco biometric. Status: ${status}`
        );

        logger.info(`✅ Attendance marked: ${customer.name} (${status})`);
    }

    // Emit real-time event
    getIO().emit('zkteco:attendance', {
        customer: {
            id: customer._id,
            name: customer.name,
            photo: customer.photo,
            plan: customer.plan,
            validity: customer.validity,
            status: status
        },
        timestamp: timestamp || new Date(),
        alreadyMarked: !!alreadyMarked
    });

    sendSuccess(res, 200, { customer, status }, 'Attendance processed');
});

/**
 * @desc    Clear attendance logs from device
 * @route   POST /api/zkteco/clear-logs
 * @access  Private (Admin)
 */
const clearAttendanceLogs = asyncHandler(async (req, res, next) => {
    await zktecoService.clearAttendanceLogs();
    sendSuccess(res, 200, null, 'Successfully cleared attendance logs from device');
});

module.exports = {
    connectDevice,
    disconnectDevice,
    getDeviceStatus,
    enrollMember,
    removeMember,
    syncAllMembers,
    getEnrolledUsers,
    getAttendanceLogs,
    processAttendance,
    clearAttendanceLogs
};
