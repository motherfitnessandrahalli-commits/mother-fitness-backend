const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function run() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');

        const Customer = require(path.join(__dirname, '../src/models/Customer'));
        const Payment = require(path.join(__dirname, '../src/models/Payment'));

        const memberId = 'U007';

        console.log(`🔍 Looking for member: ${memberId}\n`);

        const customer = await Customer.findOne({ memberId: memberId.toUpperCase() });

        if (!customer) {
            console.log(`❌ Customer not found with memberId: ${memberId}`);
            process.exit(0);
        }

        console.log('✅ Customer found:');
        console.log(`   Name: ${customer.name}`);
        console.log(`   MongoDB _id: ${customer._id}`);
        console.log(`   memberId: ${customer.memberId}\n`);

        // Check payments by customer _id (what the API uses)
        const paymentsByCustomerId = await Payment.find({ customerId: customer._id });
        console.log(`💳 Payments found by customerId (${customer._id}):`);
        console.log(`   Count: ${paymentsByCustomerId.length}`);

        if (paymentsByCustomerId.length > 0) {
            paymentsByCustomerId.forEach((p, i) => {
                console.log(`\n   Payment ${i + 1}:`);
                console.log(`     Amount: ₹${p.amount}`);
                console.log(`     Date: ${new Date(p.paymentDate).toLocaleDateString()}`);
                console.log(`     Plan: ${p.planType}`);
            });
        } else {
            console.log('   ⚠️  No payments found!\n');
        }

        // Check ALL payments for this customer name
        const paymentsByName = await Payment.find({ customerName: new RegExp(customer.name, 'i') });
        console.log(`\n\n💳 Payments found by customerName ("${customer.name}"):`);
        console.log(`   Count: ${paymentsByName.length}`);

        if (paymentsByName.length > 0) {
            paymentsByName.forEach((p, i) => {
                const matches = p.customerId.toString() === customer._id.toString();
                console.log(`\n   Payment ${i + 1}:`);
                console.log(`     Amount: ₹${p.amount}`);
                console.log(`     Date: ${new Date(p.paymentDate).toLocaleDateString()}`);
                console.log(`     Plan: ${p.planType}`);
                console.log(`     customerId: ${p.customerId}`);
                console.log(`     CustomerID matches? ${matches ? '✅ YES' : '❌ NO - MISMATCH!'}`);
            });
        }

        // Diagnosis
        if (paymentsByCustomerId.length === 0 && paymentsByName.length > 0) {
            console.log('\n\n⚠️  PROBLEM IDENTIFIED:');
            console.log('   Payments exist for this member but with WRONG customerId!');
            console.log(`   Expected customerId: ${customer._id}`);
            console.log(`   Actual customerId in payments: ${paymentsByName[0]?.customerId}`);
            console.log('\n💡 SOLUTION: Run the fix script to update payment customerIds');
        } else if (paymentsByCustomerId.length === 0 && paymentsByName.length === 0) {
            console.log('\n\n❌ NO PAYMENTS FOUND AT ALL');
            console.log('   The member truly has no payment records in the database.');
        } else {
            console.log('\n\n✅ Payments are correctly linked!');
            console.log('   The issue might be with the API or frontend.');
        }

        mongoose.connection.close();
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

run();
