const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { Customer, Payment } = require('../src/models');

async function debugCustomer(memberId) {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to DB');

        const customer = await Customer.findOne({ memberId });
        if (!customer) {
            console.log(`Customer ${memberId} not found`);
            return;
        }

        console.log('--- Customer Details ---');
        console.log(`Name: ${customer.name}`);
        console.log(`Member ID: ${customer.memberId}`);
        console.log(`Balance: ${customer.balance}`);
        console.log(`Status: ${customer.status} (from validity: ${customer.validity})`);
        console.log(`ID: ${customer._id}`);

        const payments = await Payment.find({ customerId: customer._id });
        console.log('\n--- Payments History ---');
        if (payments.length === 0) {
            console.log('No payments found for this customer');
        } else {
            payments.forEach(p => {
                console.log(`Date: ${p.paymentDate}, Amount: ${p.amount}, Status: ${p.status}, Mode: ${p.paymentMethod}`);
            });
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.connection.close();
    }
}

const targetMemberId = process.argv[2] || 'U010';
debugCustomer(targetMemberId);
