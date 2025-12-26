const mongoose = require('mongoose');
const { Customer, Payment } = require('../src/models');
const dotenv = require('dotenv');
dotenv.config();

async function checkDuplicates() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to DB');

        const customers = await Customer.find({ memberId: 'U009' });
        console.log(`Found ${customers.length} customers with memberId: U009`);

        customers.forEach(c => {
            console.log(`- Customer: ${c.name}, ID: ${c._id}, Email: ${c.email}`);
        });

        const allPayments = await Payment.find({ customerName: 'gandi' });
        console.log(`Found ${allPayments.length} payments for "gandi"`);
        allPayments.forEach(p => {
            console.log(`- Payment ID: ${p._id}, Linked customerId: ${p.customerId}`);
        });

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

checkDuplicates();
