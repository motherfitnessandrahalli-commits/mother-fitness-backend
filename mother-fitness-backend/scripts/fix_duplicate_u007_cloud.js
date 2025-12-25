const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');

async function run() {
    try {
        console.log('🧹 deduplicating U007 on Cloud...');

        if (!process.env.CLOUD_MONGODB_URI) throw new Error('No CLOUD URI');
        const conn = await mongoose.createConnection(process.env.CLOUD_MONGODB_URI).asPromise();

        const Customer = conn.model('Customer', new mongoose.Schema({}, { strict: false }));
        const Payment = conn.model('Payment', new mongoose.Schema({}, { strict: false }));

        // 1. Find ALL U007s
        const users = await Customer.find({ memberId: 'U007' });
        console.log(`Found ${users.length} users with memberId 'U007'.`);

        if (users.length <= 1) {
            console.log('✅ No duplicates found. Exiting.');
            // Only one user, check their ID against payments
            if (users.length === 1) {
                const p = await Payment.countDocuments({ customerId: users[0]._id });
                console.log(`User ${users[0]._id} has ${p} payments.`);
            }
            conn.close();
            return;
        }

        // 2. Identify "Best" User (most recent or with password)
        // We want the one that SyncService is updating (which is finding by memberId "upsert").
        // Actually, upsert might be finding the *first* one.

        // Let's assume the first one found is the "Active" one for now?
        // Or better: Checking which one has payments?

        let userWithPayments = null;
        for (const u of users) {
            const count = await Payment.countDocuments({ customerId: u._id });
            console.log(`User ${u._id} (Created: ${u.createdAt}) has ${count} payments.`);
            if (count > 0) userWithPayments = u;
        }

        if (!userWithPayments) {
            console.log('⚠️ No U007 has payments attached directly. Picking the newest one as main.');
            users.sort((a, b) => b.createdAt - a.createdAt); // Newest first
            userWithPayments = users[0];
        }

        console.log(`🏆 KEEPER User: ${userWithPayments._id}`);

        // 3. Delete others
        for (const u of users) {
            if (u._id.toString() !== userWithPayments._id.toString()) {
                console.log(`🗑️ Deleting Duplicate: ${u._id}`);
                await Customer.deleteOne({ _id: u._id });
            }
        }

        console.log('✅ Deduplication complete.');
        conn.close();

    } catch (error) {
        console.error('❌ Error:', error);
    }
}

run();
