const axios = require('axios');
const logger = require('../config/logger');

/**
 * CloudSyncService
 * Responsible for synchronizing local data to the cloud mirror
 */
class CloudSyncService {
    constructor() {
        this.cloudUrl = process.env.CLOUD_API_URL;
        this.syncKey = process.env.SYNC_KEY;
        this.isSyncing = false;
        this.queue = []; // Simple in-memory queue for now
    }

    /**
     * Sync a specific record
     * @param {String} type - 'customer' | 'attendance' | 'payment'
     * @param {Object} data - The data object to sync
     */
    async syncRecord(type, data) {
        if (!this.cloudUrl) {
            logger.warn('Cloud Sync: CLOUD_API_URL not configured. Skipping sync.');
            return;
        }

        try {
            logger.info(`Cloud Sync: Syncing ${type} ${data._id || data.id}`);

            const response = await axios.post(`${this.cloudUrl}/api/sync/${type}`, data, {
                headers: {
                    'X-Sync-Key': this.syncKey,
                    'Content-Type': 'application/json'
                },
                timeout: 5000
            });

            if (response.status === 200 || response.status === 201) {
                logger.info(`Cloud Sync: Successfully synced ${type}`);
                return true;
            }
        } catch (error) {
            logger.error(`Cloud Sync Error (${type}): ${error.message}`);
            // Add to queue for later if it's a network error
            this.addToQueue(type, data);
            return false;
        }
    }

    addToQueue(type, data) {
        this.queue.push({ type, data, timestamp: new Date() });
        logger.info(`Cloud Sync: Added ${type} to retry queue. Queue size: ${this.queue.length}`);
    }

    /**
     * Start periodic sync worker
     */
    startWorker() {
        setInterval(() => this.processQueue(), 5 * 60 * 1000); // Every 5 minutes
    }

    async processQueue() {
        if (this.isSyncing || this.queue.length === 0) return;

        this.isSyncing = true;
        logger.info(`Cloud Sync: Processing queue of ${this.queue.length} items`);

        const itemsToProcess = [...this.queue];
        this.queue = [];

        for (const item of itemsToProcess) {
            const success = await this.syncRecord(item.type, item.data);
            if (!success) {
                // Keep in queue if it failed again
                // (Note: this simple approach might cause loops if it's a validation error, 
                // but usually it's network in this context)
            }
        }

        this.isSyncing = false;
    }
}

module.exports = new CloudSyncService();
