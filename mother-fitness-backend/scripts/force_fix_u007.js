const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const forceFix = async () => {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected.');

        // Define simple schemas to avoid model loading issues
        const customerSchema = new mongoose.Schema({ memberId: String, name: String });
        const paymentSchema = new mongoose.Schema({ customerId: mongoose.Schema.Types.ObjectId, customerName: String, amount: Number });

        // Use existing collections
        const Customer = mongoose.model('Customer', customerSchema, 'customers');
        const Payment = mongoose.model('Payment', paymentSchema, 'payments');

        const memberIdToFix = 'U007';

        // 1. Find the target customer
        console.log(`\n🔍 Searching for customer with memberId: ${memberIdToFix}`);
        const customer = await Customer.findOne({ memberId: memberIdToFix.toUpperCase() });

        if (!customer) {
            console.log('❌ Customer U007 not found!');
            process.exit(1);
        }

        console.log(`✅ Found Customer: ${customer.name} (ID: ${customer._id})`);

        // 2. Find payments that MIGHT belong to this user (by name)
        // We use a regex to be flexible with name matching
        const nameRegex = new RegExp(customer.name, 'i');
        console.log(`\n🔍 Searching for payments with name matching: "${customer.name}"`);

        const matchingPayments = await Payment.find({ customerName: nameRegex });
        console.log(`Found ${matchingPayments.length} payments matching name "${customer.name}".`);

        if (matchingPayments.length === 0) {
            console.log('⚠️ No payments found by name. Checking if any payments exist for this ID...');
            const idPayments = await Payment.find({ customerId: customer._id });
            console.log(`Found ${idPayments.length} payments with correct ID.`);
        }

        // 3. Update the payments
        let updatedCount = 0;
        for (const payment of matchingPayments) {
            if (payment.customerId.toString() !== customer._id.toString()) {
                console.log(`\n🛠 Fixing payment:`);
                console.log(`   - Amount: ${payment.amount}`);
                console.log(`   - Current Customer ID: ${payment.customerId}`);
                console.log(`   - Expected Customer ID: ${customer._id}`);

                payment.customerId = customer._id;
                await payment.save();
                updatedCount++;
                console.log('   ✅ Updated.');
            } else {
                console.log(`   ✔ Payment ${payment._id} already has correct ID.`);
            }
        }

        console.log(`\n🎉 Summary: ${updatedCount} payments were fixed.`);

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.connection.close();
        console.log('👋 Done.');
        process.exit(0);
    }
};

forceFix();
