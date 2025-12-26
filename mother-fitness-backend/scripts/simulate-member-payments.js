const mongoose = require('mongoose');
const { Customer, Payment } = require('../src/models');
const dotenv = require('dotenv');
dotenv.config();

async function simulateRoute() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to DB');

        const customer = await Customer.findOne({ memberId: 'U009' });
        if (!customer) {
            console.log('Customer U009 not found');
            return;
        }

        console.log(`Simulating for: ${customer.name} (ID: ${customer._id})`);

        // This is what memberController.getMemberPayments does:
        const userId = new mongoose.Types.ObjectId(customer._id.toString());
        console.log(`Querying for customerId: ${userId}`);

        const verifyCount = await Payment.countDocuments({ customerId: userId });
        console.log(`[Simulation] Found ${verifyCount} payments in DB for this user`);

        const payments = await Payment.find({ customerId: userId })
            .sort({ paymentDate: -1 });

        console.log(`[Simulation] Payments length: ${payments.length}`);
        payments.forEach(p => {
            console.log(`- ${p.planType}: ₹${p.amount} (${p.paymentDate})`);
        });

    } catch (err) {
        console.error('Simulation Error:', err);
    } finally {
        await mongoose.disconnect();
    }
}

simulateRoute();
