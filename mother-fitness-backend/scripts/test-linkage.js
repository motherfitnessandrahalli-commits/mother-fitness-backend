const mongoose = require('mongoose');
const { Customer, Payment } = require('../src/models');
const dotenv = require('dotenv');
dotenv.config();

async function testLinkage() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to DB');

        const payment = await Payment.findOne({ customerName: 'gandi' });
        if (!payment) {
            console.log('Payment for "gandi" not found');
            return;
        }

        console.log(`Payment ID: ${payment._id}`);
        console.log(`Linked customerId (from payment object): ${payment.customerId}`);
        console.log(`Type of linked customerId: ${typeof payment.customerId}`);
        console.log(`Is it ObjectId? ${payment.customerId instanceof mongoose.Types.ObjectId}`);

        const customerById = await Customer.findById(payment.customerId);
        if (customerById) {
            console.log(`SUCCESS: Found customer by ID: ${customerById.name}`);
        } else {
            console.log(`FAILURE: Could not find customer with ID: ${payment.customerId}`);

            // Try searching for the customer by name to see their REAL ID
            const customerByName = await Customer.findOne({ name: 'gandi' });
            if (customerByName) {
                console.log(`Customer found by name: ${customerByName.name}, REAL ID: ${customerByName._id}`);
                console.log(`Do they match? ${customerByName._id.equals(payment.customerId)}`);
                console.log(`ID string comparison: "${customerByName._id.toString()}" === "${payment.customerId.toString()}" is ${customerByName._id.toString() === payment.customerId.toString()}`);
            }
        }

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

testLinkage();
