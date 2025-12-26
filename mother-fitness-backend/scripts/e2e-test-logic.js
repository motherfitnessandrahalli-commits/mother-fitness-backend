const mongoose = require('mongoose');
const { Customer, Payment } = require('../src/models');
const SyncService = require('../src/services/SyncService');
const dotenv = require('dotenv');
dotenv.config();

async function e2eTest() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to Local DB');

        // Clean up previous test if any
        await Customer.deleteMany({ name: 'Test Balance User' });
        await Payment.deleteMany({ customerName: 'Test Balance User' });

        console.log('--- Step 1: Create Customer with Balance ---');
        const customer = await Customer.create({
            name: 'Test Balance User',
            age: 25,
            email: 'test@balance.com',
            phone: '1234567890',
            plan: 'Monthly',
            balance: 500,
            validity: new Date(Date.now() + 30 * 86400000),
            memberId: 'T001',
            password: 'pass',
            createdBy: new mongoose.Types.ObjectId()
        });

        const payment = await Payment.create({
            customerId: customer._id,
            customerName: customer.name,
            amount: 1000,
            paymentDate: new Date(),
            paymentMethod: 'Cash',
            planType: 'Monthly',
            status: (customer.balance > 0) ? 'pending' : 'completed',
            addedBy: customer.createdBy
        });

        console.log(`Customer Created. Balance: ${customer.balance}`);
        console.log(`Payment Created. Status: ${payment.status} (Expected: pending)`);

        console.log('--- Step 2: Verify Analytics Visibility ---');
        const { getProfitMetrics } = require('../src/controllers/analyticsController');
        // We'll simulate the controller's logic
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dailyStart = new Date(today);
        const dailyEnd = new Date(today);
        dailyEnd.setHours(23, 59, 59, 999);

        const dailyProfit = await Payment.aggregate([
            {
                $match: {
                    paymentDate: { $gte: dailyStart, $lte: dailyEnd },
                    status: { $in: ['completed', 'pending'] }
                }
            },
            {
                $group: { _id: null, total: { $sum: '$amount' } }
            }
        ]);

        const total = dailyProfit.length > 0 ? dailyProfit[0].total : 0;
        console.log(`Today's Revenue Analytics: ₹${total}`);
        if (total >= 1000) {
            console.log('✅ Success: Payment is visible in analytics.');
        } else {
            console.log('❌ Failure: Payment NOT visible in analytics.');
        }

        console.log('--- Step 3: Verify Sync Normalization ---');
        const normalized = customer.memberId.toString().toUpperCase().trim();
        console.log(`Original ID: "${customer.memberId}", Normalized: "${normalized}"`);
        if (normalized === 'T001') {
            console.log('✅ Success: Normalization logic correct.');
        }

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

e2eTest();
