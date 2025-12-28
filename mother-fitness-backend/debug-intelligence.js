
const mongoose = require('mongoose'); // Import mongoose directly
const { Customer, Attendance } = require('./src/models');
const AlertService = require('./src/services/AlertService'); // Adjust path as the script is in root

// Connect to MongoDB
require('dotenv').config();

const runDebug = async () => {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected.');

        console.log('\n--- Debugging Gym Health Score ---');
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const activeVisitorsIds = await Attendance.distinct('customerId', {
            timestamp: { $gte: sevenDaysAgo }
        });
        console.log(`Unique Active Visitors (Last 7 Days): ${activeVisitorsIds.length}`);

        const activeCustomersCount = await Customer.countDocuments({ validity: { $gte: today } });
        console.log(`Total Active Customers: ${activeCustomersCount}`);

        const realActiveVisitors = await Customer.countDocuments({
            _id: { $in: activeVisitorsIds },
            validity: { $gte: today }
        });
        console.log(`Active Visitors who are still Valid Members: ${realActiveVisitors}`);

        const utilizationRate = activeCustomersCount > 0
            ? Math.round((realActiveVisitors / activeCustomersCount) * 100)
            : 0;
        console.log(`Calculated Health Score: ${utilizationRate}%`);


        console.log('\n--- Debugging Churn Alerts (Attention List) ---');
        const customers = await Customer.find({ validity: { $gte: today } });
        console.log(`Scanning ${customers.length} active customers for risks...`);

        for (const customer of customers) {
            const attAlert = await AlertService.calculateAttendanceDrop(customer._id);
            if (attAlert) {
                console.log(`[ALERT] ${customer.name}: ${attAlert.message} (Attendance Drop)`);
            }

            const durAlert = await AlertService.calculateDurationDrop(customer._id);
            if (durAlert) {
                console.log(`[ALERT] ${customer.name}: ${durAlert.message} (Duration Drop)`);
            }
        }

    } catch (error) {
        console.error('Debug Error:', error);
    } finally {
        await mongoose.disconnect();
    }
};

runDebug();
