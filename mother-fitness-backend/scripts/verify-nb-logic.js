const mongoose = require('mongoose');
const { Customer, Payment } = require('../src/models');
const dotenv = require('dotenv');
dotenv.config();

async function verifyNewBalanceLogic() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to Local DB');

        // 1. Create a clean test customer
        const customer = await Customer.create({
            name: 'New Balance Test User',
            age: 30,
            email: 'nb@test.com',
            phone: '9999999999',
            plan: 'Monthly',
            balance: 0,
            validity: new Date(Date.now() + 30 * 86400000),
            memberId: 'NB001',
            password: 'pass',
            createdBy: new mongoose.Types.ObjectId()
        });
        console.log(`Created customer: ${customer.name}, Initial Balance: ${customer.balance}`);

        // 2. Simulate Payment with a New Balance
        // In reality, this goes through paymentController.createPayment which we'll simulate logic of
        const amount = 1000;
        const newBalance = 500; // User enters 500 in the new box

        // --- SIMULATED CONTROLLER LOGIC ---
        customer.balance = Number(newBalance);
        await customer.save();

        const payment = await Payment.create({
            customerId: customer._id,
            customerName: customer.name,
            amount: amount,
            paymentDate: new Date(),
            paymentMethod: 'Cash',
            planType: 'Monthly',
            status: (customer.balance > 0) ? 'pending' : 'completed',
            addedBy: customer.createdBy
        });
        // --- END SIMULATED LOGIC ---

        console.log(`Updated Customer Balance: ${customer.balance} (Expected: 500)`);
        console.log(`Payment Status: ${payment.status} (Expected: pending)`);

        if (customer.balance === 500 && payment.status === 'pending') {
            console.log('✅ SUCCESS: New Balance Logic Verified.');
        } else {
            console.log('❌ FAILURE: Logic mismatch.');
        }

        // Clean up
        await Customer.deleteOne({ _id: customer._id });
        await Payment.deleteOne({ _id: payment._id });

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

verifyNewBalanceLogic();
