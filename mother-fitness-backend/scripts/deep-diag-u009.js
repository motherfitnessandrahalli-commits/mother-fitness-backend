const mongoose = require('mongoose');
const { Customer, Payment } = require('../src/models');
const dotenv = require('dotenv');
dotenv.config();

async function deepDiag() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to DB');

        const customer = await Customer.findOne({ memberId: 'U009' });
        if (!customer) {
            console.log('Customer U009 not found');
            return;
        }

        console.log('--- Customer Info ---');
        console.log(`Name: ${customer.name}`);
        console.log(`ID: ${customer._id}`);
        console.log(`ID Type: ${typeof customer._id}`);
        console.log(`Collection: ${customer.collection.name}`);

        const payment = await Payment.findOne({ customerName: 'gandi' });
        if (!payment) {
            console.log('Payment for "gandi" not found');
            return;
        }

        console.log('--- Payment Info ---');
        console.log(`Payment ID: ${payment._id}`);
        console.log(`Linked customerId: ${payment.customerId}`);
        console.log(`Type of linked customerId: ${typeof payment.customerId}`);
        console.log(`Collection: ${payment.collection.name}`);

        // Try direct find with ObjectId
        const pCountObj = await Payment.countDocuments({ customerId: customer._id });
        console.log(`Query by customer._id (ObjectId): ${pCountObj} found`);

        // Try direct find with String (converted to Hex)
        const pCountStr = await Payment.countDocuments({ customerId: customer._id.toString() });
        console.log(`Query by customer._id.toString(): ${pCountStr} found`);

        // Check for any whitespace or hidden chars in IDs (if they were strings)
        if (typeof payment.customerId === 'string') {
            console.log(`Length of string ID: ${payment.customerId.length}`);
            console.log(`Raw bytes: ${Buffer.from(payment.customerId).toString('hex')}`);
        }

        // List ALL payment customerIds for inspection
        const allCustIds = await Payment.find({}).select('customerId customerName');
        console.log('--- All Payments Linkage ---');
        allCustIds.forEach(p => {
            console.log(`Name: ${p.customerName}, customerId: ${p.customerId}, Type: ${typeof p.customerId}`);
        });

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

deepDiag();
