const axios = require('axios');
const fs = require('fs');
const path = require('path');
const logger = require('../config/logger');

/**
 * CloudSyncService
 * Responsible for synchronizing local data to the cloud mirror
 * Uses a persistent local queue to handle offline periods
 */
class CloudSyncService {
    constructor() {
        this.cloudUrl = process.env.CLOUD_API_URL;
        this.syncKey = process.env.SYNC_KEY;
        this.isSyncing = false;
        this.queuePath = path.join(process.cwd(), 'data', 'sync-queue.json');
        this.queue = this.loadQueue();

        if (this.cloudUrl) {
            logger.info('🛰️  Cloud Sync: ENABLED (Hybrid Mode)');
            this.startWorker();
        } else {
            logger.info('🛰️  Cloud Sync: DISABLED (Local Mode Only)');
        }
    }

    /**
     * Load queue from disk
     */
    loadQueue() {
        try {
            const dataDir = path.join(process.cwd(), 'data');
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir);
            }
            if (fs.existsSync(this.queuePath)) {
                return JSON.parse(fs.readFileSync(this.queuePath, 'utf8'));
            }
        } catch (error) {
            logger.error(`Cloud Sync: Error loading queue: ${error.message}`);
        }
        return [];
    }

    /**
     * Save queue to disk
     */
    saveQueue() {
        try {
            fs.writeFileSync(this.queuePath, JSON.stringify(this.queue, null, 2));
        } catch (error) {
            logger.error(`Cloud Sync: Error saving queue: ${error.message}`);
        }
    }

    /**
     * Sync a specific record
     * @param {String} type - 'customer' | 'attendance' | 'payment'
     * @param {Object} data - The data object to sync
     */
    async syncRecord(type, data) {
        if (!this.cloudUrl) return;

        // Add to queue first (Persistence First)
        this.addToQueue(type, data);

        // Try to sync immediately
        this.processQueue();
    }

    addToQueue(type, data) {
        // Prevent duplicate IDs in queue - update entry if it exists
        const id = data._id || data.id;
        const existingIndex = this.queue.findIndex(item => item.type === type && (item.data._id === id || item.data.id === id));

        if (existingIndex > -1) {
            this.queue[existingIndex] = { type, data, timestamp: new Date() };
        } else {
            this.queue.push({ type, data, timestamp: new Date() });
        }

        this.saveQueue();
    }

    /**
     * Start periodic sync worker
     */
    startWorker() {
        // Process queue every minute
        setInterval(() => this.processQueue(), 60 * 1000);
        logger.info('🛰️  Cloud Sync: Worker started (1 min interval)');
    }

    async processQueue() {
        if (this.isSyncing || this.queue.length === 0 || !this.cloudUrl) return;

        this.isSyncing = true;

        const originalQueueSize = this.queue.length;
        const successfulIndices = [];

        for (let i = 0; i < this.queue.length; i++) {
            const item = this.queue[i];
            try {
                const response = await axios.post(`${this.cloudUrl}/api/sync/${item.type}`, item.data, {
                    headers: {
                        'X-Sync-Key': this.syncKey,
                        'Content-Type': 'application/json'
                    },
                    timeout: 5000
                });

                if (response.status === 200 || response.status === 201) {
                    successfulIndices.push(i);
                }
            } catch (error) {
                logger.error(`🛰️  Cloud Sync: Error syncing ${item.type} (${item.data._id}): ${error.message}`);
                if (error.response) {
                    logger.error(`🛰️  Cloud Sync: Server replied with ${error.response.status}: ${JSON.stringify(error.response.data)}`);
                }
                break; // Stop processing queue if internet is down or server error
            }
        }

        if (successfulIndices.length > 0) {
            // Remove successful items from queue
            this.queue = this.queue.filter((_, index) => !successfulIndices.includes(index));
            this.saveQueue();
            logger.info(`🛰️  Cloud Sync: Successfully synced ${successfulIndices.length}/${originalQueueSize} pending items`);
        }

        this.isSyncing = false;
    }
}

module.exports = new CloudSyncService();
