const axios = require('axios');
const SyncQueue = require('../models/SyncQueue');
const logger = require('../config/logger');

class CloudSyncService {
    constructor() {
        this.cloudUrl = process.env.CLOUD_API_URL;
        this.syncKey = process.env.SYNC_KEY;
        this.isSyncing = false;

        // Start worker
        if (this.cloudUrl) {
            logger.info('🛰️  Cloud Sync: ENABLED (MongoDB Queue)');
            this.startWorker();
        } else {
            logger.info('🛰️  Cloud Sync: DISABLED');
        }
    }

    /**
     * Add record to sync queue
     * @param {String} entity - 'MEMBER', 'PAYMENT', 'ATTENDANCE', 'ANNOUNCEMENT'
     * @param {Object} data - The full document
     * @param {String} action - 'UPSERT' (default) or 'DELETE'
     */
    async syncRecord(entity, data, action = 'UPSERT') {
        if (!this.cloudUrl) return;

        try {
            const entityId = data.memberId || data.paymentId || data.attendanceId || data._id; // Resolve ID based on entity type logic if needed, or just use _id if others not present. 
            // Better ID resolution:
            // MEMBER -> memberId
            // PAYMENT -> paymentId
            // ATTENDANCE -> attendanceId ? The spec says _id is ObjectId. Attendance usually has valid _id. 
            // Actually, the models have:
            // Customer -> memberId
            // Payment -> paymentId
            // Attendance -> attendanceId (I added it in the schema, wait. Yes: attendanceId: String)
            // Announcement -> _id (mongo ID)

            let resolvedId = data._id;
            if (entity === 'customer' || entity === 'MEMBER') {
                resolvedId = data.memberId;
                entity = 'MEMBER';
            } else if (entity === 'payment' || entity === 'PAYMENT') {
                resolvedId = data.paymentId;
                entity = 'PAYMENT';
            } else if (entity === 'attendance' || entity === 'ATTENDANCE') {
                // The earlier Attendance schema has `attendanceId`.
                resolvedId = data.attendanceId || data._id;
                entity = 'ATTENDANCE';
            } else if ((entity === 'announcement' || entity === 'ANNOUNCEMENT')) {
                resolvedId = data._id;
                entity = 'ANNOUNCEMENT';
            }

            const payload = data.toObject ? data.toObject() : data;

            // Create Sync Entry
            await SyncQueue.create({
                entity: entity.toUpperCase(),
                entityId: resolvedId,
                action: action.toUpperCase(),
                payload: payload,
                status: 'PENDING'
            });

            // Trigger sync (optional: throttle this if high volume)
            this.processQueue();

        } catch (error) {
            logger.error(`[CloudSync] Error adding to queue: ${error.message}`);
        }
    }

    startWorker() {
        // Run every 30 seconds
        setInterval(() => this.processQueue(), 30 * 1000);
    }

    async processQueue() {
        if (this.isSyncing || !this.cloudUrl) return;

        try {
            this.isSyncing = true;

            // Fetch pending items
            const pendingItems = await SyncQueue.find({ status: 'PENDING' }).sort({ createdAt: 1 }).limit(10);

            if (pendingItems.length === 0) {
                this.isSyncing = false;
                return;
            }

            logger.info(`[CloudSync] Processing ${pendingItems.length} items...`);

            for (const item of pendingItems) {
                try {
                    // Send to Cloud
                    await axios.post(`${this.cloudUrl}/api/sync/v2`, { // Assumed generic endpoint or specific ones
                        entity: item.entity,
                        entityId: item.entityId,
                        action: item.action,
                        payload: item.payload
                    }, {
                        headers: { 'X-Sync-Key': this.syncKey },
                        timeout: 10000
                    });

                    // Mark Success
                    item.status = 'SUCCESS';
                    await item.save();

                } catch (error) {
                    console.error(`[CloudSync] Failed item ${item._id}: ${error.message}`);
                    item.status = 'FAILED'; // Or retry logic (increment retryCount)
                    item.retryCount += 1;
                    if (item.retryCount < 5) {
                        item.status = 'PENDING'; // Retry later
                        item.lastAttemptAt = new Date();
                    }
                    await item.save();
                }
            }

        } catch (error) {
            logger.error(`[CloudSync] Worker error: ${error.message}`);
        } finally {
            this.isSyncing = false;
        }
    }
}

module.exports = new CloudSyncService();
