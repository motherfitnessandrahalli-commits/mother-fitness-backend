/**
 * FIX SCRIPT: Update payment customerIds to match the correct customer _id
 * This fixes the issue where payments have wrong customerId
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function fixPayments() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');

        const Customer = require(path.join(__dirname, '../src/models/Customer'));
        const Payment = require(path.join(__dirname, '../src/models/Payment'));

        const memberId = 'U007';

        // Find ALL customers with this memberId
        const customers = await Customer.find({ memberId: memberId.toUpperCase() });

        console.log(`Found ${customers.length} customer(s) with memberId ${memberId}\n`);

        if (customers.length === 0) {
            console.log('❌ No customers found');
            process.exit(1);
        }

        // If multiple customers, we need to decide which is the correct one
        let correctCustomer;

        if (customers.length > 1) {
            console.log('⚠️  Multiple customer records found:');
            for (let i = 0; i < customers.length; i++) {
                const c = customers[i];
                const paymentCount = await Payment.countDocuments({ customerId: c._id });
                console.log(`\n   ${i + 1}. _id: ${c._id}`);
                console.log(`      Name: ${c.name}`);
                console.log(`      Created: ${new Date(c.createdAt).toLocaleString()}`);
                console.log(`      Payments: ${paymentCount}`);
                console.log(`      Has Password: ${!!c.password}`);
            }

            // Use the one WITH password (the one used for login)
            correctCustomer = customers.find(c => c.password);
            if (!correctCustomer) {
                // Fallback to first one
                correctCustomer = customers[0];
            }

            console.log(`\n✅ Using customer: ${correctCustomer._id} (has password: ${!!correctCustomer.password})`);
        } else {
            correctCustomer = customers[0];
            console.log(`✅ Single customer found: ${correctCustomer._id}`);
        }

        // Find payments by customer NAME (in case customerId is wrong)
        const paymentsByName = await Payment.find({
            customerName: new RegExp(correctCustomer.name, 'i')
        });

        console.log(`\n💳 Found ${paymentsByName.length} payment(s) by customer name\n`);

        if (paymentsByName.length === 0) {
            console.log('No payments to fix');
            process.exit(0);
        }

        // Check which payments need fixing
        let fixedCount = 0;
        for (const payment of paymentsByName) {
            if (payment.customerId.toString() !== correctCustomer._id.toString()) {
                console.log(`Fixing payment ${payment._id}:`);
                console.log(`  Old customerId: ${payment.customerId}`);
                console.log(`  New customerId: ${correctCustomer._id}`);

                payment.customerId = correctCustomer._id;
                await payment.save();
                fixedCount++;
            }
        }

        console.log(`\n✅ Fixed ${fixedCount} payment(s)`);
        console.log(`\n🎉 Member ${memberId} should now see their payment history!`);

        mongoose.connection.close();
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

fixPayments();
