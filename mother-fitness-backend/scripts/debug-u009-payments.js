const mongoose = require('mongoose');
const { Customer, Payment } = require('../src/models');
const dotenv = require('dotenv');
dotenv.config();

async function debugU009() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to DB');

        const customer = await Customer.findOne({ memberId: 'U009' });
        if (!customer) {
            console.log('Customer U009 not found');
            return;
        }
        console.log(`Found Customer: ${customer.name} (ID: ${customer._id})`);

        // 1. Search by ObjectId (Mongoose)
        const pByObj = await Payment.find({ customerId: customer._id });
        console.log(`1. Found ${pByObj.length} payments by customer._id (ObjectId)`);

        // 2. Search by String (Mongoose)
        const pByStr = await Payment.find({ customerId: customer._id.toString() });
        console.log(`2. Found ${pByStr.length} payments by customer._id.toString() (String)`);

        // 3. Raw search (bypass Mongoose)
        const pRawStr = await Payment.collection.find({ customerId: customer._id.toString() }).toArray();
        console.log(`3. Found ${pRawStr.length} payments by raw collection search with String`);

        const pRawObj = await Payment.collection.find({ customerId: customer._id }).toArray();
        console.log(`4. Found ${pRawObj.length} payments by raw collection search with ObjectId`);

        // Inspect the document from name search again
        const nameP = await Payment.findOne({ customerName: customer.name });
        if (nameP) {
            const rawP = await Payment.collection.findOne({ _id: nameP._id });
            console.log('--- Raw Payment Data (bypass Mongoose) ---');
            console.log(`_id: ${rawP._id}`);
            console.log(`customerId value: "${rawP.customerId}"`);
            console.log(`customerId type: ${typeof rawP.customerId}`);
            console.log(`Is customerId a MongoDB ObjectId?: ${rawP.customerId instanceof mongoose.Types.ObjectId || (rawP.customerId && rawP.customerId._bsontype === 'ObjectID')}`);
        }

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

debugU009();
