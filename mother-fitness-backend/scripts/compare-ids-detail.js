const mongoose = require('mongoose');
const { Customer, Payment } = require('../src/models');
const dotenv = require('dotenv');
dotenv.config();

async function compareIds() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to DB');

        const customer = await Customer.findOne({ name: 'gandi' });
        const payment = await Payment.collection.findOne({ customerName: 'gandi' });

        if (!customer || !payment) {
            console.log('Missing customer or payment');
            return;
        }

        const id1 = customer._id;
        const id2 = payment.customerId;

        console.log('ID 1 (Customer):', id1, typeof id1, id1.constructor.name);
        console.log('ID 2 (Payment):', id2, typeof id2, id2.constructor.name);

        console.log('Strict Equality (===):', id1 === id2);
        console.log('Mongoose equals():', id1.equals ? id1.equals(id2) : 'N/A');
        console.log('String comparison:', id1.toString() === id2.toString());

        // Deep inspection
        console.log('ID 1 prototype:', Object.getPrototypeOf(id1).constructor.name);
        console.log('ID 2 prototype:', Object.getPrototypeOf(id2).constructor.name);

        // Try to fix it by re-casting
        const id2Fixed = new mongoose.Types.ObjectId(id2.toString());
        console.log('Fixed ID 2 equals ID 1?', id1.equals(id2Fixed));

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

compareIds();
