const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { Customer, Payment } = require('../src/models');

async function fixData() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to DB');

        // 1. Fix undefined balances
        const result = await Customer.updateMany(
            { balance: { $exists: false } },
            { $set: { balance: 0 } }
        );
        console.log(`Fixed ${result.modifiedCount} customers with undefined balance`);

        // 2. Check U010 specifically
        const customer = await Customer.findOne({ memberId: 'U010' });
        if (customer) {
            console.log(`U010 Balance now: ${customer.balance}`);

            // 3. Check its payments and their customerId type
            const rawPayments = await mongoose.connection.db.collection('payments').find({
                $or: [
                    { customerId: customer._id },
                    { customerId: customer._id.toString() }
                ]
            }).toArray();

            console.log(`\nFound ${rawPayments.length} raw payments for U010`);
            rawPayments.forEach(p => {
                console.log(`Payment ID: ${p._id}`);
                console.log(`customerId type: ${typeof p.customerId === 'object' ? 'ObjectId' : typeof p.customerId}`);
                console.log(`customerId value: ${p.customerId}`);
            });
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.connection.close();
    }
}

fixData();
