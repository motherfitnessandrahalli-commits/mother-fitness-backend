const mongoose = require('mongoose');
const { Customer, Attendance } = require('../models');
const hardwareService = require('./HardwareService');
const timeline = require('./TimelineService');
const logger = require('../config/logger');
const { getIO } = require('../config/socket');
const { getLocalDateString, getLocalTimeString } = require('../utils/helpers');

/**
 * AccessControlService
 * Handles the logic for gym entry and exit rules.
 */
class AccessControlService {
    /**
     * Process an access request from a device
     * @param {Object} eventData - { userId, timestamp, deviceRole, deviceIp }
     */
    async processAccessRequest(eventData) {
        const { userId, deviceRole } = eventData;
        logger.info(`🔍 [AccessControl] Processing request for ${userId} (${deviceRole})`);

        try {
            // 1. Find the customer
            // Safely check if userId is an ObjectId before querying _id to prevent Casting Errors
            const query = mongoose.Types.ObjectId.isValid(userId)
                ? { $or: [{ memberId: userId }, { _id: userId }] }
                : { memberId: userId };

            const customer = await Customer.findOne(query);

            if (!customer) {
                // CHECK ADMIN PROFILE
                // If not a customer, check if it's an Admin Card ID
                const { AdminProfile } = require('../models');
                const adminProfile = await AdminProfile.getSingleton();

                if (adminProfile && adminProfile.memberIds && adminProfile.memberIds.includes(userId.toString())) {
                    logger.info(`👑 Admin Access Granted: ID ${userId}`);

                    // Create a strict admin "customer" object for UI
                    const adminUser = {
                        _id: 'ADMIN',
                        name: adminProfile.name || 'Admin',
                        memberId: userId,
                        photo: adminProfile.photo || '',
                        status: 'active',
                        plan: 'OWNER',
                        isInside: deviceRole === 'IN'
                    };

                    await hardwareService.openDoor();

                    const result = {
                        customer: adminUser,
                        type: deviceRole,
                        message: 'Welcome Boss! 👑',
                        isAdmin: true
                    };

                    this.emitAccessResult('allowed', result);
                    return { success: true, status: 'allowed', ...result };
                }

                logger.warn(`⚠️ Access denied: Unknown user ID ${userId}`);
                const result = { success: false, status: 'denied', reason: 'Unknown Member', userId };
                this.emitAccessResult('denied', result);
                return result;
            }

            const isEntry = deviceRole === 'IN';

            let result;
            if (isEntry) {
                logger.info(`➡️ [AccessControl] Calling handleEntry for ${customer.name} (isInside: ${customer.isInside})`);
                result = await this.handleEntry(customer, eventData);
            } else {
                logger.info(`⬅ [AccessControl] Calling handleExit for ${customer.name} (isInside: ${customer.isInside})`);
                result = await this.handleExit(customer, eventData);
            }
            logger.info(`✅ [AccessControl] Processing completed for ${customer.name}`);
            return result;

        } catch (error) {
            logger.error(`Error in AccessControlService: ${error.message} \n ${error.stack}`);
            return {
                success: false,
                status: 'error',
                message: error.message || 'Access processing failed'
            };
        }
    }

    /**
     * Logic for ENTRY (IN)
     */
    async handleEntry(customer, eventData) {
        const todayStr = getLocalDateString();
        const now = new Date();
        const zktecoService = require('./ZKTecoService'); // Lazy load to avoid circular dep

        // 1. Calculate Membership Days Remaining
        // We need to parse validity date strictly
        // Assuming customer.validity is a Date object or ISO string
        let daysRemaining = -1;

        if (customer.validity) {
            const validityDate = new Date(customer.validity);
            validityDate.setHours(23, 59, 59, 999); // End of that day

            const diffTime = validityDate - now;
            daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        }

        // 2. Determine Action based on Expiry
        let accessGranted = false;
        let message = '';
        let voice = '';

        // DEBUG LOG
        logger.info(`[Access] ${customer.name}: Days Remaining = ${daysRemaining}`);

        if (daysRemaining <= 0) {
            // EXPIRED
            logger.warn(`🚫 Entry Denied: ${customer.name} - Expired`);
            message = 'Access Denied: Membership Expired';
            voice = 'Access Denied. Your membership has expired. Please renew at reception.';
            accessGranted = false;
        }
        else if (daysRemaining === 1) {
            // LAST DAY
            logger.warn(`⚠ Entry Allowed (Last Day): ${customer.name}`);
            message = 'Welcome! Expires TODAY (1 Day left)';
            voice = `Welcome ${customer.name}. Your membership expires today. Please renew.`;
            accessGranted = true;
        }
        else if (daysRemaining <= 3) {
            // WARNING 2-3 DAYS
            logger.warn(`⚠ Entry Allowed (Expiring): ${customer.name} - ${daysRemaining} days left`);
            message = `Welcome! Expires in ${daysRemaining} days`;
            voice = `Welcome ${customer.name}. Your membership expires in ${daysRemaining} days.`;
            accessGranted = true;
        }
        else {
            // NORMAL ENTRY
            logger.info(`✅ Entry Allowed: ${customer.name}`);
            message = 'Welcome to Mother Fitness';
            voice = `Welcome ${customer.name}`;

            // Balance Check Override
            if (customer.balance > 0) {
                message = `Welcome! Balance Due: ₹${customer.balance}`;
                voice = `Welcome ${customer.name}. You have a pending balance.`;
            }

            accessGranted = true;
        }

        // 3. Handle Decision
        if (!accessGranted) {
            const result = {
                customer,
                reason: 'Membership Expired',
                voice,
                message
            };
            this.emitAccessResult('denied', result);
            return { success: false, status: 'denied', ...result };
        }

        // 4. Anti-Passback Check
        if (customer.isInside) {
            logger.warn(`🚫 Anti-Passback: ${customer.name} is already inside.`);
            const result = {
                customer,
                reason: 'Anti-Passback Breach',
                voice: 'Already inside. Please scan out first.'
            };
            this.emitAccessResult('denied', result);
            return { success: false, status: 'denied', ...result };
        }

        // 5. GRANT ACCESS

        // Open Door via ZKTeco Device (if IP is available)
        if (eventData.deviceIp && eventData.deviceIp !== 'manual') {
            await zktecoService.unlockDevice(eventData.deviceIp);
        } else {
            // Fallback for manual or testing
            logger.info('🔓 Manual/Test Entry - No device IP to send unlock command');
        }

        // Update Customer Status
        customer.isInside = true;
        customer.lastActivity = now;
        customer.totalVisits += 1;
        await customer.save();

        // Create Attendance Log
        await Attendance.create({
            customerId: customer._id,
            memberId: customer.memberId, // Required field
            customerName: customer.name,
            date: todayStr,
            time: getLocalTimeString(),
            timestamp: now,
            membershipStatus: customer.membershipStatus,
            type: 'IN',
            direction: 'IN', // Required by schema
            deviceId: eventData.deviceIp || 'ZKTeco-IN'
        });

        // Log to Timeline
        await timeline.logEvent(
            customer._id,
            'CHECK_IN',
            'Checked In (Entry)',
            `Entered gym via ${eventData.deviceIp || 'IN Device'}. Msg: ${message}`
        );

        logger.info(`🔔 [AccessControl] Emitting ALLOWED for ${customer.name}`);
        const result = { customer, type: 'IN', message, voice };
        this.emitAccessResult('allowed', result);
        return { success: true, status: 'allowed', ...result };
    }

    /**
     * Logic for EXIT (OUT) - ALWAYS FRIENDLY
     */
    async handleExit(customer, eventData) {
        const todayStr = getLocalDateString();
        const now = new Date();
        const zktecoService = require('./ZKTecoService');

        logger.info(`🚪 Exit Triggered: ${customer.name}`);

        // Unlock Exit Door
        if (eventData.deviceIp && eventData.deviceIp !== 'manual') {
            await zktecoService.unlockDevice(eventData.deviceIp);
        }

        // Update Customer Status
        customer.isInside = false;
        customer.lastActivity = now;
        await customer.save();

        // Create Attendance Log
        await Attendance.create({
            customerId: customer._id,
            memberId: customer.memberId, // Required field
            customerName: customer.name,
            date: todayStr,
            time: getLocalTimeString(),
            timestamp: now,
            membershipStatus: customer.membershipStatus, // Use actual status field, not derived 'status' if possible, or fallback
            type: 'OUT',
            direction: 'OUT', // Required by schema
            deviceId: eventData.deviceIp || 'ZKTeco-OUT'
        });

        // Log to Timeline
        await timeline.logEvent(
            customer._id,
            'CHECK_OUT',
            'Checked Out (Exit)',
            `Exited gym via ${eventData.deviceIp || 'OUT Device'}`
        );

        const result = { customer, type: 'OUT', message: 'Goodbye! Have a nice day.' };
        this.emitAccessResult('allowed', result);
        return { success: true, status: 'allowed', ...result };
    }

    /**
     * Emit result to Socket.IO for frontend
     */
    emitAccessResult(status, data) {
        getIO().emit('access:result', {
            success: status === 'allowed',
            status, // 'allowed' or 'denied'
            ...data,
            timestamp: new Date()
        });
    }

    /**
     * Get real-time gym occupancy count
     */
    async getLiveCount() {
        return await Customer.countDocuments({ isInside: true });
    }

    /**
     * Get list of members currently inside
     */
    async getInsideMembers() {
        return await Customer.find({ isInside: true })
            .select('name memberId photo plan validity');
    }
}

module.exports = new AccessControlService();
