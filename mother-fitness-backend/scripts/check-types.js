const mongoose = require('mongoose');
const { Payment } = require('../src/models');
const dotenv = require('dotenv');
dotenv.config();

async function checkTypes() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to DB');

        const stringCount = await Payment.collection.countDocuments({ customerId: { $type: 2 } }); // 2 = String
        const objectIdCount = await Payment.collection.countDocuments({ customerId: { $type: 7 } }); // 7 = ObjectId
        const otherCount = await Payment.collection.countDocuments({ customerId: { $not: { $type: [2, 7] } } });

        console.log(`Payments with String customerId: ${stringCount}`);
        console.log(`Payments with ObjectId customerId: ${objectIdCount}`);
        console.log(`Payments with Other customerId: ${otherCount}`);

        if (stringCount > 0) {
            const sample = await Payment.collection.findOne({ customerId: { $type: 2 } });
            console.log('--- Sample String customerId ---');
            console.log(`Payment ID: ${sample._id}`);
            console.log(`customerId: "${sample.customerId}"`);
            console.log(`Length: ${sample.customerId.length}`);
        }

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

checkTypes();
