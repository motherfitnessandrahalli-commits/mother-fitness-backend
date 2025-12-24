const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

async function verifyCleanDatabase() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');

        const Customer = require('../src/models/Customer');
        const Attendance = require('../src/models/Attendance');
        const Payment = require('../src/models/Payment');
        const User = require('../src/models/User');

        // Count documents
        const customerCount = await Customer.countDocuments();
        const attendanceCount = await Attendance.countDocuments();
        const paymentCount = await Payment.countDocuments();
        const userCount = await User.countDocuments();

        console.log('📊 Database Status:');
        console.log('-------------------');
        console.log(`Customers: ${customerCount}`);
        console.log(`Attendance Records: ${attendanceCount}`);
        console.log(`Payments: ${paymentCount}`);
        console.log(`Admin Users: ${userCount}\n`);

        // Check for u002 specifically
        const u002 = await Customer.findOne({ memberId: /u002/i });
        if (u002) {
            console.log('❌ User u002 still exists!');
        } else {
            console.log('✅ User u002 has been removed.\n');
        }

        if (customerCount === 0 && attendanceCount === 0 && paymentCount === 0) {
            console.log('✅ SUCCESS: Database is clean and ready for fresh data!');
        } else {
            console.log('⚠️  Database still contains some data.');
        }

        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

verifyCleanDatabase();
