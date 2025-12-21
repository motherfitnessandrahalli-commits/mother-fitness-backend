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

module.exports = {
    mockBiometricEvent
};
