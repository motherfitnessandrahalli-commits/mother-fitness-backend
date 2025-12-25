const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const inspect = async () => {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected.');

        const customerSchema = new mongoose.Schema({ memberId: String, name: String });
        // Make schema loose to inspect raw data
        const paymentSchema = new mongoose.Schema({}, { strict: false });

        const Customer = mongoose.model('Customer', customerSchema, 'customers');
        const Payment = mongoose.model('Payment', paymentSchema, 'payments');

        const memberId = 'U007';
        const customer = await Customer.findOne({ memberId: memberId.toUpperCase() });

        if (!customer) {
            console.log('❌ Customer not found');
            process.exit(1);
        }

        console.log(`\n👤 Customer: ${customer.name}`);
        console.log(`   _id: ${customer._id} (Type: ${customer._id.constructor.name})`);
        console.log(`   String: "${customer._id.toString()}"`);

        // Find payments by regex name
        const payments = await Payment.find({ customerName: new RegExp(customer.name, 'i') });
        console.log(`\n💳 Found ${payments.length} payments by name.`);

        payments.forEach((p, i) => {
            console.log(`\n   [Payment ${i + 1}] ID: ${p._id}`);
            const custId = p.get('customerId'); // Use get to bypass schema casting if possible

            console.log(`     customerId value: ${custId}`);
            if (custId) {
                console.log(`     Type: ${custId.constructor.name}`);
                if (custId.constructor.name === 'ObjectId') {
                    console.log(`     Hex: ${custId.toHexString()}`);
                    console.log(`     Matches Customer ID? ${custId.equals(customer._id)}`);
                } else {
                    console.log(`     String Match? ${custId === customer._id.toString()}`);
                }
            } else {
                console.log(`     ⚠️ customerId field is MISSING or NULL`);
            }
        });

        // Try to query exactly like the controller
        console.log(`\n🔬 Testing Controller Query Logic:`);
        // Case 1: passing ObjectId
        const p1 = await Payment.find({ customerId: customer._id });
        console.log(`   Query with ObjectId found: ${p1.length}`);

        // Case 2: passing String
        const p2 = await Payment.find({ customerId: customer._id.toString() });
        console.log(`   Query with String found: ${p2.length}`);

    } catch (error) {
        console.error(error);
    } finally {
        await mongoose.connection.close();
        process.exit(0);
    }
};

inspect();
