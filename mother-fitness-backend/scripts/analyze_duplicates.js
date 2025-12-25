const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const analyzeDuplicates = async () => {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected.');

        const customerSchema = new mongoose.Schema({
            memberId: String,
            name: String,
            email: String,
            phone: String
        }, { strict: false });

        const paymentSchema = new mongoose.Schema({
            customerId: mongoose.Schema.Types.ObjectId,
            amount: Number
        }, { strict: false });

        const Customer = mongoose.model('Customer', customerSchema, 'customers');
        const Payment = mongoose.model('Payment', paymentSchema, 'payments');

        const targetId = 'U007';
        console.log(`\n🔍 Searching for ALL customers with memberId: "${targetId}" (case-insensitive)`);

        // Find all matches, ignoring case
        const customers = await Customer.find({
            memberId: { $regex: new RegExp(`^${targetId}$`, 'i') }
        });

        console.log(`\nFound ${customers.length} customer record(s).`);

        for (const c of customers) {
            console.log(`\n--------------------------------------------------`);
            console.log(`👤 Customer Record:`);
            console.log(`   _id:       ${c._id}`);
            console.log(`   memberId:  ${c.memberId}`);
            console.log(`   Name:      ${c.name}`);
            console.log(`   Phone:     ${c.phone || 'N/A'}`);
            console.log(`   Email:     ${c.email || 'N/A'}`);
            console.log(`   Password:  ${c.password ? '✅ YES' : '❌ NO'}`);

            const paymentCount = await Payment.countDocuments({ customerId: c._id });
            console.log(`   💰 Linked Payments: ${paymentCount}`);

            if (paymentCount > 0) {
                const payments = await Payment.find({ customerId: c._id }).limit(3);
                console.log(`      Sample: ${payments.map(p => '₹' + p.amount).join(', ')}`);
            }
        }
        console.log(`--------------------------------------------------\n`);

        if (customers.length > 1) {
            console.log('🚨 CONCLUSION: DUPLICATE RECORDS FOUND!');
            console.log('The app is likely logging into the record with NO payments.');
        } else if (customers.length === 1) {
            console.log('ℹ️ CONCLUSION: Single record found.');
            if (await Payment.countDocuments({ customerId: customers[0]._id }) === 0) {
                console.log('⚠️ But it has NO payments linked.');
            } else {
                console.log('✅ It has payments linked. Issue is likely strict ObjectId casting or network caching.');
            }
        } else {
            console.log('❌ CONCLUSION: Customer not found at all.');
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.connection.close();
        process.exit(0);
    }
};

analyzeDuplicates();
