const mongoose = require('mongoose');
const { Customer, Payment } = require('../src/models');
const SyncService = require('../src/services/SyncService');
const dotenv = require('dotenv');
dotenv.config();

async function forceSync() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to Local DB');

        await SyncService.init();
        if (!SyncService.isConnected) {
            console.error('Failed to connect to Cloud for sync');
            return;
        }

        const customer = await Customer.findOne({ memberId: 'U009' });
        if (!customer) {
            console.log('Customer U009 not found locally');
            return;
        }

        const payments = await Payment.find({ customerId: customer._id });
        console.log(`Found ${payments.length} local payments for U009`);

        for (const p of payments) {
            console.log(`Syncing payment ${p._id} (₹${p.amount})...`);
            await SyncService.syncPayment(p, customer);
        }

        console.log('Sync requests sent to SyncService.');

        // Wait a bit for processing if it was queued
        console.log('Waiting for queue processing...');
        await new Promise(resolve => setTimeout(resolve, 10000));

    } catch (err) {
        console.error('Force Sync Error:', err);
    } finally {
        process.exit(0);
    }
}

forceSync();
