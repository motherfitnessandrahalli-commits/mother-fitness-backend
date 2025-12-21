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

        // 1. Check Membership Status
        const status = customer.status; // Uses virtual field
        if (status === 'expired') {
            logger.warn(`🚫 Entry Denied: ${customer.name} - Membership Expired`);
            const result = {
                customer,
                reason: 'Membership Expired',
                voice: 'Membership expired. Please see reception.'
            };
            this.emitAccessResult('denied', result);
            return { success: false, status: 'denied', ...result };
        }

        // 2. Anti-Passback Check
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

        // 3. ALLOW ENTRY
        logger.info(`✅ Entry Allowed: ${customer.name}`);

        // Open Door
        await hardwareService.openDoor();

        // Update Customer Status
        customer.isInside = true;
        customer.lastActivity = now;
        customer.totalVisits += 1;
        await customer.save();

        // Create Attendance Log
        await Attendance.create({
            customerId: customer._id,
            customerName: customer.name,
            date: todayStr,
            time: getLocalTimeString(),
            timestamp: now,
            membershipStatus: status,
            type: 'IN',
            deviceId: eventData.deviceIp || 'ZKTeco-IN'
        });

        // Log to Timeline
        await timeline.logEvent(
            customer._id,
            'CHECK_IN',
            'Checked In (Entry)',
            `Entered gym via ${eventData.deviceIp || 'IN Device'}. Status: ${status}`
        );

        logger.info(`🔔 [AccessControl] Emitting ALLOWED for ${customer.name}`);
        const result = { customer, type: 'IN', message: 'Membership Active' };
        this.emitAccessResult('allowed', result);
        return { success: true, status: 'allowed', ...result };
    }

    /**
     * Logic for EXIT (OUT) - ALWAYS FRIENDLY
     */
    async handleExit(customer, eventData) {
        const todayStr = getLocalDateString();
        const now = new Date();

        logger.info(`🚪 Exit Triggered: ${customer.name}`);

        // Open Door - ALWAYS for exit safety
        await hardwareService.openDoor();

        // Update Customer Status
        customer.isInside = false;
        customer.lastActivity = now;
        await customer.save();

        // Create Attendance Log (to track stay duration)
        await Attendance.create({
            customerId: customer._id,
            customerName: customer.name,
            date: todayStr,
            time: getLocalTimeString(),
            timestamp: now,
            membershipStatus: customer.status,
            type: 'OUT',
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
