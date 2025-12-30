const accessControl = require('../services/AccessControlService');
const { Customer } = require('../models');
const { asyncHandler, sendSuccess, AppError } = require('../utils/errorHandler');
const logger = require('../config/logger');

/**
 * @desc    Mock Biometric event for testing
 * @route   POST /api/biometric/mock
 */
const mockBiometricEvent = asyncHandler(async (req, res, next) => {
    // Handle both mock format (member_id) and real device format (user_id)
    const member_id = req.body.user_id || req.body.member_id;
    const direction = req.body.direction;

    if (!member_id) {
        return next(new AppError('member_id or user_id is required', 400));
    }

    const dir = (direction || 'IN').toUpperCase();

    logger.info(`🧪 Biometric Mock: Member ${member_id} at ${dir}`);
    console.log('🔥 MOCK SCAN RECEIVED:', req.body);

    // Process through Access Control Service
    const result = await accessControl.processAccessRequest({
        userId: member_id,
        deviceRole: dir,
        deviceIp: 'mock-simulator'
    });

    console.log('🏁 SERVICE RESULT:', result);

    if (!result) {
        logger.error('❌ AccessControlService returned undefined!');
        return res.status(500).json({
            success: false,
            message: 'Internal processing error: Service returned no response'
        });
    }

    // Map service status to frontend expected "decision" (ALLOW/DENY)
    const decision = result.status === 'allowed' ? 'ALLOW' : 'DENY';

    // Return the response format expected by the user
    res.status(200).json({
        success: result.success || false,
        member_id: member_id,
        direction: dir,
        decision: decision,
        message: result.reason || result.message || (result.success ? 'Membership Active' : 'Access Blocked'),
        customer: result.customer
    });
});

/**
 * @desc    Process real Biometric event from hardware
 * @route   POST /api/biometric/event
 */
const processBiometricEvent = asyncHandler(async (req, res, next) => {
    // Log raw body for debugging hardware integration
    logger.info(`📥 Raw Biometric Signal: ${JSON.stringify(req.body)}`);

    // Standard hardware format often uses 'user_id' or 'member_id'
    // New ZKTeco format uses: pin, eventTime, verifyModeName, readerName, devName
    const userId = req.body.pin || req.body.user_id || req.body.userId || req.body.member_id;
    const rawTime = req.body.eventTime || req.body.timestamp;
    const deviceIp = req.body.devName || req.body.device_ip || req.ip;

    // Direction mapping (readerName is often 'Other' or 'Entry'/'Exit' or 'IN'/'OUT')
    let direction = 'IN';
    const reader = (req.body.readerName || '').toUpperCase();
    if (reader.includes('OUT') || reader.includes('EXIT')) {
        direction = 'OUT';
    } else if (req.body.direction) {
        direction = req.body.direction.toUpperCase();
    }

    if (!userId) {
        return next(new AppError('User identifier (pin/user_id) is required', 400));
    }

    logger.info(`📟 Hardware Event: User ${userId} at [${direction}] from ${deviceIp} at ${rawTime || 'now'}`);

    // Process through Access Control Service
    const result = await accessControl.processAccessRequest({
        userId,
        deviceRole: direction,
        deviceIp,
        timestamp: rawTime ? new Date(rawTime) : new Date()
    });

    if (!result) {
        return next(new AppError('Access Control Service failed to process request', 500));
    }

    // Return production-standard response in ZKTeco hardware format
    const isAllowed = result.status === 'allowed';

    res.status(200).json({
        ret: isAllowed ? "200" : "400",
        msg: isAllowed ? "Operation successful. Access Granted." : (result.message || result.reason || "Operation failed. Access Denied."),
        data: isAllowed ? "0" : "1", // 0 = ALLOW/OPEN, 1 = DENY/LOCK
        i18nArgs: null,
        success: isAllowed,
        // Optional: Keep internal metadata for debugging/UI logs if needed, 
        // but the device primarily cares about 'data' and 'success'
        userId,
        customer: result.customer ? {
            name: result.customer.name,
            status: result.customer.status
        } : null
    });
});

module.exports = {
    mockBiometricEvent,
    processBiometricEvent
};
