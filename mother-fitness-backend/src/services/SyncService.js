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
                membershipStatus: String, planType: String, endDate: Date
            }, { strict: false, timestamps: true }); // Strict false allows other fields if needed, but we control what we send

            const paymentSchema = new mongoose.Schema({
                customerId: mongoose.Schema.Types.ObjectId, // Cloud User ID
                customerName: String, amount: Number, paymentDate: Date,
                paymentMethod: String, planType: String, status: String,
                debug_source: String
            }, { strict: false });

            const announcementSchema = new mongoose.Schema({
                title: String, message: String, type: String,
                startDate: Date, endDate: Date, isActive: Boolean
            }, { strict: false, timestamps: true });

            this.cloudCustomer = this.cloudConnection.model('Customer', customerSchema);
            this.cloudPayment = this.cloudConnection.model('Payment', paymentSchema);
            this.cloudAnnouncement = this.cloudConnection.model('Announcement', announcementSchema);

            // Start Queue Processor
            setInterval(() => this.processQueue(), 60000); // Check queue every minute

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
            memberId: memberData.memberId,
            name: memberData.name,
            email: memberData.email,
            phone: memberData.phone,
            password: memberData.password, // Encrypted
            gender: memberData.gender,
            joinDate: memberData.joinDate,
            membershipStatus: memberData.membershipStatus,
            planType: memberData.planPlan || memberData.planType,
            endDate: memberData.endDate
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
            memberId: memberData.memberId, // Key to find cloud user
            amount: paymentData.amount,
            paymentDate: paymentData.paymentDate,
            paymentMethod: paymentData.paymentMethod,
            planType: paymentData.planType,
            status: paymentData.status,
            customerName: memberData.name
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

        await this._addToQueue('create_payment', payload);
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


    // --- Internal Worker Methods ---

    async _pushMemberToCloud(payload) {
        // Upsert based on memberId
        const filter = { memberId: payload.memberId };
        const update = { ...payload, lastSyncedAt: new Date() };
        await this.cloudCustomer.findOneAndUpdate(filter, update, { upsert: true, new: true });
    }

    async _pushPaymentToCloud(payload) {
        // 1. Find Cloud Customer ID
        const cloudUser = await this.cloudCustomer.findOne({ memberId: payload.memberId });
        if (!cloudUser) {
            throw new Error(`Cloud user not found for ${payload.memberId} (Deferring payment sync)`);
        }

        // 2. Insert Payment
        // Check duplicate by some unique key if possible, mostly just insert
        // Using localPaymentId as a key in notes or meta? For now just insert.
        await this.cloudPayment.create({
            customerId: cloudUser._id,
            customerName: payload.customerName,
            amount: payload.amount,
            paymentDate: payload.paymentDate,
            paymentMethod: payload.paymentMethod,
            planType: payload.planType,
            status: payload.status,
            debug_source: 'SYNC_SERVICE'
        });
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
                    } else if (item.operation === 'create_payment') {
                        await this._pushPaymentToCloud(item.payload);
                    } else if (item.operation === 'CREATE_ANNOUNCEMENT') {
                        await this._pushAnnouncementToCloud(item.payload);
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
