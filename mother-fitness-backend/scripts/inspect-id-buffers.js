const mongoose = require('mongoose');
const { Customer, Payment } = require('../src/models');
const dotenv = require('dotenv');
dotenv.config();

async function inspectBuffers() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);

        const customer = await Customer.findOne({ name: 'gandi' });
        const payment = await Payment.collection.findOne({ customerName: 'gandi' });

        const id1 = customer._id;
        const id2 = payment.customerId;

        console.log('--- ID 1 (Customer) ---');
        console.log('String:', id1.toString());
        console.log('Hex Buffer:', id1.id.toString('hex'));

        console.log('--- ID 2 (Payment) ---');
        console.log('String:', id2.toString());
        // For native driver ObjectId, the buffer is often in .id or can be derived
        const buf2 = id2.id ? id2.id.toString('hex') : Buffer.from(id2.toString(), 'hex').toString('hex');
        console.log('Hex Buffer:', buf2);

        console.log('Buffers match?', id1.id.toString('hex') === buf2);

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

inspectBuffers();
