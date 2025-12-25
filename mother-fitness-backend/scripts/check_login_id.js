const mongoose = require('mongoose');
const path = require('path');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function checkLogin() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');

        const Customer = require(path.join(__dirname, '../src/models/Customer'));
        const Payment = require(path.join(__dirname, '../src/models/Payment'));

        const memberId = 'U007';
        const password = 'pass12345';

        console.log(`🔐 Testing login for: ${memberId}\n`);

        // Step 1: Find customer (what login does)
        const customer = await Customer.findOne({ memberId: memberId.toUpperCase() }).select('+password');

        if (!customer) {
            console.log(`❌ Customer not found`);
            process.exit(1);
        }

        console.log('✅ Customer found:');
        console.log(`   Name: ${customer.name}`);
        console.log(`   MongoDB _id: ${customer._id}`);
        console.log(`   memberId: ${customer.memberId}`);
        console.log(`   Has Password: ${!!customer.password}\n`);

        // Step 2: Verify password
        if (customer.password) {
            const isMatch = await bcrypt.compare(password, customer.password);
            console.log(`🔑 Password match: ${isMatch ? '✅ YES' : '❌ NO'}\n`);
        }

        // Step 3: This is the ID that would be in JWT token (req.user.id)
        const userIdInToken = customer._id.toString();
        console.log(`🎫 JWT Token would contain user ID: ${userIdInToken}\n`);

        // Step 4: Check payments with this ID
        const payments = await Payment.find({ customerId: customer._id });
        console.log(`💳 Payments found for this user ID: ${payments.length}`);

        if (payments.length > 0) {
            console.log('\n   Payment details:');
            payments.forEach((p, i) => {
                console.log(`   ${i + 1}. ₹${p.amount} - ${p.planType} - ${new Date(p.paymentDate).toLocaleDateString()}`);
            });
        }

        // Step 5: Check ALL customers with this memberId
        const allU007 = await Customer.find({ memberId: memberId.toUpperCase() });
        console.log(`\n\n🔍 Total customers with memberId "${memberId}": ${allU007.length}`);

        if (allU007.length > 1) {
            console.log('\n⚠️  WARNING: DUPLICATE CUSTOMER RECORDS FOUND!');
            console.log('   This might be causing the issue.\n');
            allU007.forEach((c, i) => {
                console.log(`   Customer ${i + 1}:`);
                console.log(`     _id: ${c._id}`);
                console.log(`     Name: ${c.name}`);
                console.log(`     Created: ${new Date(c.createdAt).toLocaleString()}`);
            });

            // Check payments for each
            console.log('\n   Checking payments for each:');
            for (const c of allU007) {
                const p = await Payment.countDocuments({ customerId: c._id });
                console.log(`     ${c._id}: ${p} payment(s)`);
            }
        }

        console.log('\n' + '='.repeat(60));
        if (payments.length === 0) {
            console.log('❌ PROBLEM: Login succeeds but no payments for this _id');
            console.log('   Likely causes:');
            console.log('   1. Payments have different customerId');
            console.log('   2. Duplicate customer records');
            console.log('   3. Payments were created before customer record');
        } else {
            console.log('✅ Login and payments are correctly linked');
        }
        console.log('='.repeat(60));

        mongoose.connection.close();
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkLogin();
