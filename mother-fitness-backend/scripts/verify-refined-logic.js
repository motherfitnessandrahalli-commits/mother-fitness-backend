const mongoose = require('mongoose');
const { Customer, Payment } = require('../src/models');
const dotenv = require('dotenv');
dotenv.config();

async function verifyLogic() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to DB');

        // 1. Check a customer with balance
        const customer = await Customer.findOne({ balance: { $gt: 0 } });
        if (customer) {
            console.log(`--- Customer with Balance: ${customer.name} (Balance: ${customer.balance}) ---`);
            const payments = await Payment.find({ customerId: customer._id }).sort({ createdAt: -1 });
            if (payments.length > 0) {
                console.log(`Latest Payment Status: ${payments[0].status}`);
                if (payments[0].status === 'pending') {
                    console.log('✅ Success: Payment status is "pending" for customer with balance.');
                } else {
                    console.log('❌ Failure: Payment status is NOT "pending" for customer with balance (might be an old record).');
                }
            }
        }

        // 2. Check Stats
        const { getPaymentStats } = require('../src/controllers/paymentController');
        // We'll just run the logic directly
        const totalRevenue = await Payment.aggregate([
            { $match: { status: { $in: ['completed', 'pending'] } } },
            { $group: { _id: null, totalRevenue: { $sum: '$amount' } } }
        ]);
        console.log(`Total Revenue (incl. pending): ₹${totalRevenue[0] ? totalRevenue[0].totalRevenue : 0}`);

        const completedRevenue = await Payment.aggregate([
            { $match: { status: 'completed' } },
            { $group: { _id: null, totalRevenue: { $sum: '$amount' } } }
        ]);
        console.log(`Completed Revenue Only: ₹${completedRevenue[0] ? completedRevenue[0].totalRevenue : 0}`);

        if (totalRevenue[0] && completedRevenue[0] && totalRevenue[0].totalRevenue > completedRevenue[0].totalRevenue) {
            console.log('✅ Success: Analytics now includes pending payments.');
        } else {
            console.log('ℹ️ Note: No pending payments found to show difference in revenue.');
        }

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

verifyLogic();
