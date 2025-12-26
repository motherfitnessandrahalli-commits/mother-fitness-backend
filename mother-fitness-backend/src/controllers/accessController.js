const { Customer, Attendance } = require('../models');
const hardware = require('../services/HardwareService');
const { asyncHandler, sendSuccess, AppError } = require('../utils/errorHandler');
const { getLocalDateString, getLocalTimeString } = require('../utils/helpers');
const { getIO } = require('../config/socket');
const logger = require('../config/logger');
const timeline = require('../services/TimelineService');

/**
 * @desc    Verify membership and unlock door
 * @route   POST /api/access/verify
 */
const verifyAccess = asyncHandler(async (req, res, next) => {
    const { memberId } = req.body;

    if (!memberId) {
        return next(new AppError('Member ID is required', 400));
    }

    // 1. Find member (can match memberId, id, or phone)
    const customer = await Customer.findOne({
        $or: [
            { memberId: memberId },
            { phone: memberId }
        ]
    });

    if (!customer) {
        logger.warn(`🚫 Access Denied: Unknown Member ID ${memberId}`);
        // Emit failed attempt for UI feedback
        getIO().emit('access:denied', {
            message: 'Unknown Member',
            details: `ID: ${memberId}`
        });
        return next(new AppError('Member not found', 404));
    }

    const status = customer.status; // Uses virtual field

    // 2. Decision Logic
    if (status === 'active' || status === 'expiring') {
        const todayStr = getLocalDateString();

        // 3. Mark Attendance (only if not already marked today)
        const alreadyMarked = await Attendance.findOne({
            customerId: customer._id,
            date: todayStr
        });

        if (!alreadyMarked) {
            await Attendance.create({
                customerId: customer._id,
                customerName: customer.name,
                date: todayStr,
                time: getLocalTimeString(),
                membershipStatus: status,
                markedBy: req.user ? req.user.id : null // Backend might be system triggered
            });
            customer.totalVisits += 1;
            await customer.save();

            // Log check-in event to timeline
            await timeline.logEvent(
                customer._id,
                'CHECK_IN',
                'Checked In',
                `Entered gym via Biometric Access. Status: ${status}`
            );
        }

        // 4. Open Door
        const doorOpened = await hardware.openDoor();

        // 5. Emit real-time success for Dashboard
        getIO().emit('access:granted', {
            customer: {
                id: customer._id,
                name: customer.name,
                photo: customer.photo,
                plan: customer.plan,
                validity: customer.validity,
                status: status
            },
            doorOpened
        });

        logger.info(`🔓 Access Granted: ${customer.name} (${status})`);
        return sendSuccess(res, 200, { access: 'ALLOW', customer }, 'Access granted and door opened');
    } else {
        logger.warn(`🚫 Access Denied: ${customer.name} (Expired)`);

        // Emit failed attempt for UI feedback
        getIO().emit('access:denied', {
            customer: {
                name: customer.name,
                status: status
            },
            message: 'Membership Expired'
        });

        // Log denied event to timeline
        await timeline.logEvent(
            customer._id,
            'DENIED',
            'Entry Denied',
            `Denied entry due to ${status} membership.`
        );

        return sendSuccess(res, 200, { access: 'DENY', reason: 'Membership Expired' }, 'Access denied');
    }
});

/**
 * @desc    Connect to hardware door controller
 * @route   POST /api/access/connect
 */
const connectDoor = asyncHandler(async (req, res, next) => {
    const { portName } = req.body;

    if (!portName) {
        return next(new AppError('Port name is required', 400));
    }

    const connected = await hardware.connect(portName);

    if (connected) {
        sendSuccess(res, 200, { portName }, 'Successfully connected to door controller');
    } else {
        next(new AppError(`Failed to connect to ${portName}. Check if it is already in use or permissions.`, 500));
    }
});

/**
 * @desc    Get available serial ports
 * @route   GET /api/access/ports
 */
const getPorts = asyncHandler(async (req, res, next) => {
    const ports = await hardware.listPorts();
    sendSuccess(res, 200, { ports });
});

module.exports = {
    verifyAccess,
    connectDoor,
    getPorts
};
