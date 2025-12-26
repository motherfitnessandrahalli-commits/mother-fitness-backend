const mongoose = require('mongoose');
const { Payment } = require('../src/models');
const dotenv = require('dotenv');
dotenv.config();

async function checkAnalytics() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to DB');

        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        console.log('--- All Payments (Last 5) ---');
        const payments = await Payment.find().sort({ createdAt: -1 }).limit(5);
        payments.forEach(p => console.log(`${p.customerName}: ₹${p.amount} [${p.status}] on ${p.paymentDate.toISOString()}`));

        console.log('\n--- Analytics Aggregation Check ---');
        const monthly = await Payment.aggregate([
            {
                $match: {
                    paymentDate: { $gte: startOfMonth },
                    status: { $in: ['completed', 'pending'] }
                }
            },
            {
                $group: { _id: null, total: { $sum: '$amount' } }
            }
        ]);
        console.log(`Monthly Revenue (Incl. Pending): ₹${monthly[0] ? monthly[0].total : 0}`);

        const monthlyOnlyCompleted = await Payment.aggregate([
            {
                $match: {
                    paymentDate: { $gte: startOfMonth },
                    status: 'completed'
                }
            },
            {
                $group: { _id: null, total: { $sum: '$amount' } }
            }
        ]);
        console.log(`Monthly Revenue (Completed Only): ₹${monthlyOnlyCompleted[0] ? monthlyOnlyCompleted[0].total : 0}`);

        const pendingCount = await Payment.countDocuments({ status: 'pending' });
        console.log(`\nTotal Pending Payments: ${pendingCount}`);

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

checkAnalytics();
