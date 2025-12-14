require('dotenv').config();
const mongoose = require('mongoose');
const { Customer, Attendance, Payment } = require('./src/models');

const resetData = async () => {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        console.log('Clearing member data...');

        // Delete Customers (Members)
        const customerResult = await Customer.deleteMany({});
        console.log(`Deleted ${customerResult.deletedCount} customers`);

        // Delete Attendance Records
        const attendanceResult = await Attendance.deleteMany({});
        console.log(`Deleted ${attendanceResult.deletedCount} attendance records`);

        // Delete Payments
        const paymentResult = await Payment.deleteMany({});
        console.log(`Deleted ${paymentResult.deletedCount} payments`);

        console.log('-----------------------------------');
        console.log('SUCCESS: All member data has been wiped.');
        console.log('Admin users and configuration have been preserved.');
        console.log('-----------------------------------');

    } catch (error) {
        console.error('Error clearing data:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
        process.exit();
    }
};

resetData();
