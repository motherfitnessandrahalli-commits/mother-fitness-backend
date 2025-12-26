const mongoose = require('mongoose');
const { Payment } = require('../src/models');
const dotenv = require('dotenv');
dotenv.config();

async function fixPaymentIds() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to DB');

        const allPayments = await Payment.collection.find({}).toArray();
        console.log(`Total payments in collection: ${allPayments.length}`);

        let fixedCount = 0;
        for (const p of allPayments) {
            const type = typeof p.customerId;
            const isObjectId = p.customerId instanceof mongoose.Types.ObjectId || (p.customerId && p.customerId._bsontype === 'ObjectID');

            console.log(`Payment ${p._id}: customerId="${p.customerId}", Type=${type}, IsObjectId=${isObjectId}`);

            if (!isObjectId) {
                console.log(`  -> Fixing payment ${p._id}...`);
                try {
                    const objectId = new mongoose.Types.ObjectId(p.customerId.toString());
                    await Payment.collection.updateOne(
                        { _id: p._id },
                        { $set: { customerId: objectId } }
                    );
                    fixedCount++;
                    console.log(`  -> Fixed!`);
                } catch (e) {
                    console.error(`  -> Failed: ${e.message}`);
                }
            }
        }

        console.log(`Successfully fixed ${fixedCount} payments.`);

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

fixPaymentIds();
