const mongoose = require('mongoose');
const { SyncQueue } = require('../src/models');
const dotenv = require('dotenv');
dotenv.config();

async function checkSyncQueue() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to DB');

        const pending = await SyncQueue.find({
            $or: [
                { 'payload.memberId': 'U009' },
                { 'payload.customerName': 'gandi' }
            ]
        });

        console.log(`Found ${pending.length} pending operations for U009/gandi`);
        pending.forEach(p => {
            console.log(`- ID: ${p._id}, Op: ${p.operation}, Status: ${p.status}, Error: ${p.lastError || 'None'}`);
        });

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

checkSyncQueue();
