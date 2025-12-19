const { TimelineEvent } = require('../models');
const logger = require('../config/logger');

class TimelineService {
    /**
     * Log a new event for a member
     * @param {string} customerId - MongoDB ObjectId
     * @param {string} type - Event type (JOINED, RENEWED, etc.)
     * @param {string} title - Human readable title
     * @param {string} details - Optional details
     * @param {object} metadata - Optional structured data
     */
    async logEvent(customerId, type, title, details = '', metadata = {}) {
        try {
            const event = await TimelineEvent.create({
                customerId,
                type,
                title,
                details,
                metadata
            });
            logger.info(`[Timeline] ${type} logged for ${customerId}: ${title}`);
            return event;
        } catch (error) {
            logger.error(`[Timeline Error] Failed to log ${type} for ${customerId}: ${error.message}`);
            // Don't throw to prevent interrupting main process
            return null;
        }
    }

    /**
     * Get timeline for a specific customer
     */
    async getTimeline(customerId, limit = 50) {
        return await TimelineEvent.find({ customerId })
            .sort({ timestamp: -1 })
            .limit(limit);
    }
}

module.exports = new TimelineService();
