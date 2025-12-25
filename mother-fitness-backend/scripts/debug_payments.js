const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB connected');
    } catch (error) {
        console.error('MongoDB connection failed:', error);
        process.exit(1);
    }
};

const debugPayments = async () => {
    await connectDB();

    const Customer = require(path.join(__dirname, '../src/models/Customer'));
    const Payment = require(path.join(__dirname, '../src/models/Payment'));

    const memberId = 'U007';

    console.log('\n🔍 Searching for member:', memberId);

    // Find customer
    const customer = await Customer.findOne({ memberId: memberId });

    if (!customer) {
        console.log('❌ Customer not found with memberId:', memberId);
        process.exit(0);
    }

    console.log('✅ Customer found:');
    console.log('  - Name:', customer.name);
    console.log('  - MongoDB _id:', customer._id);
    console.log('  - memberId:', customer.memberId);

    // Find payments by customerId
    const payments = await Payment.find({ customerId: customer._id });

    console.log('\n💳 Payments linked to this customer (_id):', payments.length);
    if (payments.length > 0) {
        payments.forEach((p, i) => {
            console.log(`\n  Payment ${i + 1}:`);
            console.log('    - Amount: ₹' + p.amount);
            console.log('    - Date:', new Date(p.paymentDate).toLocaleDateString());
            console.log('    - Plan:', p.planType);
            console.log('    - customerId:', p.customerId);
        });
    }

    // Find ALL payments for this customer name (to check for mismatches)
    const paymentsByName = await Payment.find({ customerName: customer.name });

    console.log('\n💳 Payments by customer NAME:', paymentsByName.length);
    if (paymentsByName.length > 0) {
        paymentsByName.forEach((p, i) => {
            console.log(`\n  Payment ${i + 1}:`);
            console.log('    - Amount: ₹' + p.amount);
            console.log('    - Date:', new Date(p.paymentDate).toLocaleDateString());
            console.log('    - Plan:', p.planType);
            console.log('    - customerId:', p.customerId);
            console.log('    - Matches customer _id?', p.customerId.toString() === customer._id.toString() ? '✅ YES' : '❌ NO');
        });
    }

    if (payments.length === 0 && paymentsByName.length > 0) {
        console.log('\n⚠️  ISSUE FOUND: Payments exist for this member but customerId does not match!');
        console.log('   This means the payment records have the wrong customerId.');
        console.log('   Expected customerId:', customer._id);
    }

    process.exit(0);
};

debugPayments();
