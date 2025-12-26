const mongoose = require('mongoose');
const { Customer, Payment } = require('../src/models');
const dotenv = require('dotenv');
dotenv.config();

async function checkDb() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log(`Connected to DB: ${mongoose.connection.name}`);
        console.log(`Host: ${mongoose.connection.host}`);

        const customer = await Customer.findOne({ name: 'gandi' });
        const payment = await Payment.findOne({ customerName: 'gandi' });

        if (customer) {
            console.log('--- Customer ---');
            console.log(`Name: ${customer.name}`);
            console.log(`ID: ${customer._id}`);
            console.log(`Collection: ${customer.collection.name}`);
            console.log(`Database: ${customer.collection.conn.name}`);
        }

        if (payment) {
            console.log('--- Payment ---');
            console.log(`Customer Name: ${payment.customerName}`);
            console.log(`Linked customerId: ${payment.customerId}`);
            console.log(`Collection: ${payment.collection.name}`);
            console.log(`Database: ${payment.collection.conn.name}`);

            if (customer) {
                console.log(`Match? ${customer._id.equals(payment.customerId)}`);
                const foundAgain = await Customer.findById(payment.customerId);
                console.log(`Find Customer by payment.customerId: ${foundAgain ? 'FOUND' : 'NOT FOUND'}`);

                // Try searching the collection directly
                const raw = await mongoose.connection.db.collection(customer.collection.name).findOne({ _id: payment.customerId });
                console.log(`Raw collection search result: ${raw ? 'FOUND' : 'NOT FOUND'}`);
            }
        }

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

checkDb();
