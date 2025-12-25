const zktecoService = require('../services/ZKTecoService');
const accessControl = require('../services/AccessControlService');
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
    const { ip, port, role } = req.body;

    if (!ip) {
        return next(new AppError('Device IP address is required', 400));
    }

    try {
        const connected = await zktecoService.connect(ip, port, role);

        if (connected) {
            const status = zktecoService.getStatus();
            sendSuccess(res, 200, status, `Successfully connected to ZKTeco [${role}] device at ${ip}`);
        }
    } catch (error) {
        logger.error(`ZKTeco Connection Error: ${error.message}`);
        // Use 504 for timeout, 400 for other connection issues
        const statusCode = error.message.toLowerCase().includes('timeout') ? 504 : 400;
        return next(new AppError(`Connection failed: ${error.message}`, statusCode));
    }
});

/**
 * @desc    Disconnect from ZKTeco device
 * @route   POST /api/zkteco/disconnect
 * @access  Private (Admin)
 */
const disconnectDevice = asyncHandler(async (req, res, next) => {
    const { ip } = req.body;

    if (!ip) {
        return next(new AppError('Device IP address is required', 400));
    }

    const disconnected = await zktecoService.disconnect(ip);

    if (disconnected) {
        sendSuccess(res, 200, null, `Successfully disconnected from device at ${ip}`);
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
    sendSuccess(res, 200, status);
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

    // Enroll to all devices using memberId
    const userId = customer.memberId || customer._id.toString();
    const results = await zktecoService.enrollUser(userId, customer.name);

    // Log event
    await timeline.logEvent(
        customer._id,
        'ENROLLMENT',
        'Biometric Enrolled',
        `Enrolled in ZKTeco device(s) with ID: ${userId}`
    );

    sendSuccess(res, 200, { userId, results }, `Enrolled ${customer.name} to connected device(s)`);
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
        `Removed from ZKTeco device(s)`
    );

    sendSuccess(res, 200, null, `Successfully removed ${customer.name} from device(s)`);
});

/**
 * @desc    Sync all active members to device
 * @route   POST /api/zkteco/sync-all-members
 * @access  Private (Admin)
 */
const syncAllMembers = asyncHandler(async (req, res, next) => {
    const connectedDevices = zktecoService.getStatus().filter(d => d.connected);

    if (connectedDevices.length === 0) {
        return next(new AppError('No connected biometric devices found. Please connect a device first.', 400));
    }

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
    const results = { success: 0, failed: 0, total: users.length };
    for (const user of users) {
        const syncRes = await zktecoService.enrollUser(user.userId, user.name);
        if (syncRes.length > 0 && syncRes.some(r => r.success)) results.success++;
        else results.failed++;
    }

    sendSuccess(res, 200, results, `Successfully synced ${results.success} members across ${connectedDevices.length} device(s)`);
});

/**
 * @desc    Get occupancy info
 * @route   GET /api/zkteco/occupancy
 * @access  Private (Admin)
 */
const getOccupancy = asyncHandler(async (req, res, next) => {
    const count = await accessControl.getLiveCount();
    const members = await accessControl.getInsideMembers();
    sendSuccess(res, 200, { count, members });
});

/**
 * @desc    Get enrolled users from device
 * @route   GET /api/zkteco/enrolled-users
 * @access  Private (Admin)
 */
const getEnrolledUsers = asyncHandler(async (req, res, next) => {
    const { ip } = req.query;
    if (!ip) return next(new AppError('Device IP is required', 400));
    const users = await zktecoService.getEnrolledUsers(ip);
    sendSuccess(res, 200, { users, count: users.length });
});

/**
 * @desc    Get attendance logs from device (Legacy/Direct)
 * @route   GET /api/zkteco/attendance-logs
 * @access  Private (Admin)
 */
const getAttendanceLogs = asyncHandler(async (req, res, next) => {
    const { ip } = req.query;
    if (!ip) return next(new AppError('Device IP is required', 400));
    const deviceObj = zktecoService.ensureConnected(ip);
    const logs = await deviceObj.instance.getAttendances();
    sendSuccess(res, 200, { logs: logs.data, count: logs.data.length });
});

/**
 * @desc    Process manual check-in/out
 * @route   POST /api/zkteco/process-attendance
 * @access  Private (Admin/System)
 */
const processAttendance = asyncHandler(async (req, res, next) => {
    const { userId, type } = req.body;
    await accessControl.processAccessRequest({
        userId,
        deviceRole: type || 'IN',
        deviceIp: 'manual'
    });
    sendSuccess(res, 200, null, 'Attendance processed manually');
});

/**
 * @desc    Clear attendance logs from device
 * @route   POST /api/zkteco/clear-logs
 * @access  Private (Admin)
 */
const clearAttendanceLogs = asyncHandler(async (req, res, next) => {
    const { ip } = req.body;
    if (!ip) return next(new AppError('Device IP is required', 400));
    const deviceObj = zktecoService.ensureConnected(ip);
    await deviceObj.instance.clearAttendanceLog();
    sendSuccess(res, 200, null, `Successfully cleared attendance logs from ${ip}`);
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
    clearAttendanceLogs,
    getOccupancy
};
