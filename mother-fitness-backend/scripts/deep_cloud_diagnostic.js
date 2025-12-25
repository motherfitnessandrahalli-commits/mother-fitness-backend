const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');

async function run() {
    try {
        console.log('🔍 Deep Diagnostic of Cloud Data...');
        if (!process.env.CLOUD_MONGODB_URI) throw new Error('No CLOUD URI');
        const conn = await mongoose.createConnection(process.env.CLOUD_MONGODB_URI).asPromise();

        const Customer = conn.model('Customer', new mongoose.Schema({}, { strict: false }));
        const Payment = conn.model('Payment', new mongoose.Schema({}, { strict: false }));

        // 1. List ALL customers (IDs and names)
        const allUsers = await Customer.find({});
        console.log(`\n--- ALL CUSTOMERS IN CLOUD (${allUsers.length}) ---`);
        allUsers.forEach(u => {
            console.log(`ID: ${u._id} | MemberID: [${u.memberId}] | Name: ${u.name}`);
        });

        // 2. List ALL payments (and their customerId)
        const allPayments = await Payment.find({});
        console.log(`\n--- ALL PAYMENTS IN CLOUD (${allPayments.length}) ---`);
        allPayments.forEach(p => {
            console.log(`ID: ${p._id} | CustomerID: ${p.customerId} | Amount: ${p.amount} | Date: ${p.paymentDate}`);
        });

        // 3. Search for U007 specifically
        console.log('\n--- U007 Analysis ---');
        const u007 = await Customer.findOne({ memberId: 'U007' });
        if (u007) {
            console.log(`U007 _id is: ${u007._id}`);
            const matchingPayments = allPayments.filter(p => p.customerId?.toString() === u007._id.toString());
            console.log(`Payments linked to this _id: ${matchingPayments.length}`);
        } else {
            console.log('❌ U007 NOT FOUND via exact match.');
            const looseMatch = allUsers.filter(u => u.memberId?.trim() === 'U007');
            console.log(`Loose matches (trimmed): ${looseMatch.length}`);
        }

        conn.close();
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

run();
