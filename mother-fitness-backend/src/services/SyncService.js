const mongoose = require('mongoose');
const { SyncQueue, Customer, Payment } = require('../models');

// Singleton service to manage secondary Cloud connection
class SyncService {
    constructor() {
        this.cloudConnection = null;
        this.cloudCustomer = null;
        this.cloudPayment = null;
        this.isConnected = false;
        this.isProcessing = false;
    }

    async init() {
        if (!process.env.CLOUD_MONGODB_URI) {
            console.warn('⚠️ SyncService: No CLOUD_MONGODB_URI provided. Offline sync disabled.');
            return;
        }

        try {
            console.log('🔄 SyncService: Connecting to Cloud Database...');
            this.cloudConnection = await mongoose.createConnection(process.env.CLOUD_MONGODB_URI).asPromise();

            this.isConnected = true;
            console.log('✅ SyncService: Connected to Cloud.');

            // Define Cloud Models (Subset Schema)
            const customerSchema = new mongoose.Schema({
                memberId: String, name: String, email: String, phone: String,
                password: String, gender: String, joinDate: Date,
                password: String, gender: String, joinDate: Date,
                membershipStatus: String, planType: String, plan: Object, // Added Plan Object support
                endDate: Date
            }, { strict: false, timestamps: true }); // Strict false allows other fields if needed, but we control what we send

            const paymentSchema = new mongoose.Schema({
                localPaymentId: { type: String, unique: true }, // Deduplication key
                paymentId: String, // Cloud unique ID
                memberId: String, // Linkage by ID string (U001, etc)
                customerName: String, amount: Number, paymentDate: Date,
                paymentMethod: String, planType: String, status: String,
                debug_source: String
            }, { strict: false });

            const announcementSchema = new mongoose.Schema({
                title: String, message: String, type: String,
                startDate: Date, endDate: Date, isActive: Boolean,
                localId: String, isDeleted: Boolean, deletedAt: Date
            }, { strict: false, timestamps: true });

            this.cloudCustomer = this.cloudConnection.model('Customer', customerSchema);
            this.cloudPayment = this.cloudConnection.model('Payment', paymentSchema);
            this.cloudAnnouncement = this.cloudConnection.model('Announcement', announcementSchema);

            // Start Queue Processor
            // Start Queue Processor
            setInterval(() => this.processQueue(), 5000); // Check queue every 5 seconds (Battle-Tested Rule)

            // Start Cloud Polling (B -> A Sync)
            setInterval(() => this.pollCloudUpdates(), 5 * 60 * 1000); // Check cloud updates every 5 mins
            this.pollCloudUpdates(); // Check on startup

        } catch (error) {
            console.error('❌ SyncService Connection Error:', error.message);
            this.isConnected = false;
        }
    }

    /**
     * Poll Cloud for updates (B -> A Sync)
     */
    async pollCloudUpdates() {
        if (!this.isConnected) return;

        try {
            console.log('🔄 SyncService: Polling Cloud for updates...');
            // Find members updated in the last 10 minutes (with buffer)
            const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

            // We need a 'updatedAt' field in Cloud Schema. 
            // Assuming Mongoose adds it if timestamps: true, or we check lastSyncedAt?
            // Since we control Cloud Schema, let's rely on 'updatedAt' if available or fallback.
            // For now, let's fetch ALL and filter or rely on query. 
            // Better: querying { updatedAt: { $gt: tenMinutesAgo } }

            const updatedCloudMembers = await this.cloudCustomer.find({
                updatedAt: { $gt: tenMinutesAgo }
            });

            if (updatedCloudMembers.length > 0) {
                console.log(`📥 Found ${updatedCloudMembers.length} updated members in Cloud.`);

                for (const cloudMem of updatedCloudMembers) {
                    await this._syncToLocal(cloudMem);
                }
            }
        } catch (error) {
            console.error('❌ Cloud Poll Failed:', error.message);
        }
    }

    async _syncToLocal(cloudMem) {
        try {
            // Find Local Member
            const localMem = await Customer.findOne({ memberId: cloudMem.memberId });
            if (!localMem) return; // Don't create local members from cloud (security/process choice)

            // Check if Cloud is actually newer (prevent loop)
            // We compare specific fields: Name, Phone, Password
            let hasChanges = false;

            if (cloudMem.name && cloudMem.name !== localMem.name) {
                localMem.name = cloudMem.name;
                hasChanges = true;
            }
            if (cloudMem.phone && cloudMem.phone !== localMem.phone) {
                localMem.phone = cloudMem.phone;
                hasChanges = true;
            }
            if (cloudMem.password && cloudMem.password !== localMem.password) {
                localMem.password = cloudMem.password;
                hasChanges = true;
            }

            if (hasChanges) {
                await localMem.save();
                console.log(`✅ SyncService: Updated local member ${localMem.memberId} from Cloud.`);
            }
        } catch (err) {
            console.error(`❌ Failed to sync updated member ${cloudMem.memberId} to local:`, err.message);
        }
    }

    /**
     * Push Member to Cloud (or Queue)
     * @param {Object} memberData - The local customer object
     */
    async syncMember(memberData) {
        const payload = {
            memberId: memberData.memberId.toString().toUpperCase().trim(),
            name: memberData.name,
            email: memberData.email,
            phone: memberData.phone,
            password: memberData.password, // Encrypted
            gender: memberData.gender,
            joinDate: memberData.joinDate || memberData.createdAt,
            membershipStatus: memberData.membershipStatus || 'active',
            // Plan Logic: Support both New Object and Old String
            plan: memberData.plan,
            planType: (memberData.plan && memberData.plan.name) ? memberData.plan.name : (memberData.plan || memberData.planType),
            endDate: memberData.validity || memberData.endDate,
            balance: memberData.balance || 0
            // Explicitly NO PHOTO
        };

        if (this.isConnected) {
            try {
                await this._pushMemberToCloud(payload);
                console.log(`☁️ SyncService: Member ${payload.memberId} synced.`);
                return;
            } catch (error) {
                console.error('⚠️ Live Sync Failed, queuing:', error.message);
            }
        }

        await this._addToQueue('CREATE_MEMBER', payload);
    }

    /**
     * Push Payment to Cloud (or Queue)
     * @param {Object} paymentData 
     * @param {Object} memberData - Needed to find Cloud ID
     */
    async syncPayment(paymentData, memberData) {
        const payload = {
            localPaymentId: paymentData._id,
            paymentId: paymentData.paymentId, // Map the unique human-readable ID
            memberId: memberData.memberId.toString().toUpperCase().trim(), // Key to find cloud user
            amount: paymentData.amount,
            paymentDate: paymentData.paymentDate,
            paymentMethod: paymentData.paymentMethod,
            planType: paymentData.planType,
            status: paymentData.status,
            customerName: memberData.name,
            // New Sync Fields
            totalAmount: paymentData.totalAmount || 0,
            paidAmount: paymentData.paidAmount || 0,
            balance: paymentData.balance || 0
        };

        if (this.isConnected) {
            try {
                await this._pushPaymentToCloud(payload);
                console.log(`☁️ SyncService: Payment for ${payload.memberId} synced.`);
                return;
            } catch (error) {
                console.error('⚠️ Live Sync Failed, queuing:', error.message);
            }
        }

        await this._addToQueue('CREATE_PAYMENT', payload);
    }

    /**
     * Push Announcement to Cloud (or Queue)
     * @param {Object} announcementData 
     */
    async syncAnnouncement(announcementData) {
        const payload = {
            localId: announcementData._id,
            title: announcementData.title,
            message: announcementData.message,
            type: announcementData.type,
            startDate: announcementData.startDate,
            endDate: announcementData.endDate,
            isActive: announcementData.isActive
        };

        if (this.isConnected) {
            try {
                await this._pushAnnouncementToCloud(payload);
                console.log(`☁️ SyncService: Announcement '${payload.title}' synced.`);
                return;
            } catch (error) {
                console.error('⚠️ Live Sync Failed, queuing:', error.message);
            }
        }

        await this._addToQueue('CREATE_ANNOUNCEMENT', payload);
    }

    /**
     * Delete Announcement from Cloud (Soft Delete)
     * @param {string} localId 
     */
    async syncAnnouncementDelete(localId) {
        const payload = {
            localId: localId.toString(),
            isDeleted: true,
            deletedAt: new Date()
        };

        if (this.isConnected) {
            try {
                // ✅ Use soft delete in cloud (update, not delete)
                await this.cloudAnnouncement.updateOne(
                    { localId: localId.toString() },
                    { $set: { isDeleted: true, deletedAt: new Date() } }
                );
                console.log(`☁️ SyncService: Announcement ${localId} soft-deleted from cloud.`);
                return;
            } catch (error) {
                console.error('⚠️ Cloud Deletion Failed, queuing:', error.message);
            }
        }

        await this._addToQueue('DELETE_ANNOUNCEMENT', payload);
    }

    /**
     * Update Announcement in Cloud
     * @param {Object} announcementData 
     */
    async syncAnnouncementUpdate(announcementData) {
        const payload = {
            localId: announcementData._id.toString(),
            title: announcementData.title,
            message: announcementData.message,
            type: announcementData.type,
            startDate: announcementData.startDate,
            endDate: announcementData.endDate,
            isActive: announcementData.isActive,
            isDeleted: announcementData.isDeleted || false
        };

        if (this.isConnected) {
            try {
                await this.cloudAnnouncement.updateOne(
                    { localId: payload.localId },
                    { $set: payload },
                    { upsert: false }
                );
                console.log(`☁️ SyncService: Announcement '${payload.title}' updated in cloud.`);
                return;
            } catch (error) {
                console.error('⚠️ Cloud Update Failed, queuing:', error.message);
            }
        }

        await this._addToQueue('UPDATE_ANNOUNCEMENT', payload);
    }

    /**
     * Update Payment in Cloud
     * @param {Object} paymentData 
     * @param {Object} memberData 
     */
    async syncPaymentUpdate(paymentData, memberData) {
        const payload = {
            localId: paymentData._id.toString(),
            localMemberId: memberData._id,
            amount: paymentData.amount,
            paymentDate: paymentData.paymentDate,
            status: paymentData.status,
            paymentMethod: paymentData.paymentMethod,
            receiptNumber: paymentData.receiptNumber
        };

        if (this.isConnected) {
            try {
                await this._pushPaymentToCloud(payload);
                console.log(`☁️ SyncService: Payment ${payload.localId} updated in cloud.`);
                return;
            } catch (error) {
                console.error('⚠️ Payment Update Failed, queuing:', error.message);
            }
        }

        await this._addToQueue('UPDATE_PAYMENT', payload);
    }


    // --- Internal Worker Methods ---

    async _pushMemberToCloud(payload) {
        // Upsert based on memberId (Normalized)
        const normalizedMemberId = payload.memberId.toString().toUpperCase().trim();
        const filter = { memberId: normalizedMemberId };
        const update = { ...payload, memberId: normalizedMemberId, lastSyncedAt: new Date() };
        await this.cloudCustomer.findOneAndUpdate(filter, update, { upsert: true, new: true });
    }

    async _pushPaymentToCloud(payload) {
        // 1. Verify Cloud Customer exists (Normalized)
        const normalizedMemberId = payload.memberId.toString().toUpperCase().trim();
        const cloudUser = await this.cloudCustomer.findOne({ memberId: normalizedMemberId });
        if (!cloudUser) {
            throw new Error(`Cloud user not found for ${payload.memberId} (Deferring payment sync)`);
        }

        // 2. Upsert Payment by localPaymentId
        const filter = { localPaymentId: payload.localPaymentId.toString() };
        const update = {
            localPaymentId: payload.localPaymentId.toString(),
            paymentId: payload.paymentId, // Ensure unique paymentId lands in cloud
            memberId: normalizedMemberId, // Store memberId directly in payment for easier lookups
            customerId: cloudUser._id.toString(), // MUST be string for cloud API transport
            customerName: payload.customerName,
            amount: payload.amount,
            paymentDate: payload.paymentDate,
            paymentMethod: payload.paymentMethod,
            planType: payload.planType,
            status: payload.status,
            totalAmount: payload.totalAmount,
            paidAmount: payload.paidAmount,
            balance: payload.balance,
            debug_source: 'SYNC_SERVICE_V3'
        };

        await this.cloudPayment.findOneAndUpdate(filter, update, { upsert: true, new: true });
    }

    async _pushAnnouncementToCloud(payload) {
        // Upsert based on title+message (fuzzy identity) or just create? 
        // Best to just create a new one or update if localId exists in some meta field.
        // For now, simpler to just create.
        await this.cloudAnnouncement.create(payload);
    }

    async _addToQueue(operation, payload) {
        await SyncQueue.create({ operation, payload, status: 'pending' });
        console.log(`📥 SyncService: Queued ${operation}`);
    }

    async processQueue() {
        if (this.isProcessing || !this.isConnected) return;
        this.isProcessing = true;

        try {
            const pending = await SyncQueue.find({ status: 'pending' }).sort({ createdAt: 1 }).limit(10);
            if (pending.length === 0) {
                this.isProcessing = false;
                return;
            }

            console.log(`🔄 SyncService: Processing ${pending.length} queued items...`);

            for (const item of pending) {
                try {
                    if (item.operation === 'CREATE_MEMBER' || item.operation === 'UPDATE_MEMBER') {
                        await this._pushMemberToCloud(item.payload);
                    } else if (item.operation === 'CREATE_PAYMENT' || item.operation === 'create_payment') {
                        await this._pushPaymentToCloud(item.payload);
                    } else if (item.operation === 'UPDATE_PAYMENT') {
                        await this._pushPaymentToCloud(item.payload);
                    } else if (item.operation === 'CREATE_ANNOUNCEMENT') {
                        await this._pushAnnouncementToCloud(item.payload);
                    } else if (item.operation === 'UPDATE_ANNOUNCEMENT') {
                        await this.cloudAnnouncement.updateOne(
                            { localId: item.payload.localId },
                            { $set: item.payload },
                            { upsert: false }
                        );
                    } else if (item.operation === 'DELETE_ANNOUNCEMENT') {
                        // ✅ Soft delete in cloud
                        await this.cloudAnnouncement.updateOne(
                            { localId: item.payload.localId },
                            { $set: { isDeleted: true, deletedAt: new Date() } }
                        );
                    }

                    item.status = 'completed'; // Or delete
                    await item.deleteOne(); // Remove processed
                } catch (err) {
                    console.error(`❌ Queue Item ${item._id} failed:`, err.message);
                    item.status = 'failed';
                    item.lastError = err.message;
                    item.attempts += 1;
                    await item.save();
                }
            }
        } catch (error) {
            console.error('Queue Processor Error:', error);
        } finally {
            this.isProcessing = false;
        }
    }
}

module.exports = new SyncService();
