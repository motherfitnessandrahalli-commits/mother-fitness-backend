const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

// Define a minimal schema for the raw update if needed, or just use native driver
async function robustFix() {
    const client = new (require('mongodb').MongoClient)(process.env.MONGODB_URI);
    try {
        await client.connect();
        console.log('Connected to DB');
        const db = client.db();
        const paymentsColl = db.collection('payments');

        const stringPayments = await paymentsColl.find({ customerId: { $type: 2 } }).toArray();
        console.log(`Found ${stringPayments.length} payments with String customerId`);

        let fixedCount = 0;
        for (const p of stringPayments) {
            console.log(`Fixing payment ${p._id}: "${p.customerId}"`);
            try {
                const objectId = new (require('mongodb').ObjectId)(p.customerId);
                await paymentsColl.updateOne(
                    { _id: p._id },
                    { $set: { customerId: objectId } }
                );
                fixedCount++;
            } catch (e) {
                console.error(`Error fixing ${p._id}: ${e.message}`);
            }
        }

        console.log(`Successfully fixed ${fixedCount} payments.`);

    } catch (err) {
        console.error(err);
    } finally {
        await client.close();
    }
}

robustFix();
