const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const findAll = async () => {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected.');

        const customerSchema = new mongoose.Schema({ memberId: String, name: String }, { strict: false });
        const paymentSchema = new mongoose.Schema({ customerId: mongoose.Schema.Types.ObjectId }, { strict: false });

        const Customer = mongoose.model('Customer', customerSchema, 'customers');
        const Payment = mongoose.model('Payment', paymentSchema, 'payments');

        // Loose regex search for 007
        console.log('\n🔍 Searching for any memberId containing "007"...');
        const customers = await Customer.find({ memberId: { $regex: /007/ } });

        console.log(`Found ${customers.length} records.`);

        for (const c of customers) {
            console.log(`\n------------------------------------------------`);
            console.log(`ID:        ${c._id}`);
            console.log(`MemberID:  "${c.memberId}"`); // Quote to see whitespace
            console.log(`Name:      ${c.name}`);
            console.log(`Password:  ${c.password ? '✅ SET' : '❌ NULL'}`);

            const pCount = await Payment.countDocuments({ customerId: c._id });
            console.log(`Payments:  ${pCount}`);
        }
        console.log(`------------------------------------------------\n`);

    } catch (error) {
        console.error(error);
    } finally {
        await mongoose.connection.close();
        process.exit(0);
    }
};

findAll();
