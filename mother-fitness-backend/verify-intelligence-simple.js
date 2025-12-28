
const mongoose = require('mongoose');
const { Customer, Attendance } = require('./src/models');
const AlertService = require('./src/services/AlertService'); // Use the service directly
require('dotenv').config();

const run = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected.');

        // 1. Basic Stats
        const totalCustomers = await Customer.countDocuments();
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const activeCustomers = await Customer.find({ 'membership.endDate': { $gte: today } });
        const activeCustomersCount = activeCustomers.length;
        console.log(`Active Customers: ${activeCustomersCount}`);

        // 2. Alert Scan
        const attentionList = [];
        for (const customer of activeCustomers) {
            console.log(`Scanning ${customer.name}...`);
            const attAlert = await AlertService.calculateAttendanceDrop(customer._id);
            if (attAlert) {
                console.log(`[ALERT] ${customer.name}: ${attAlert.message}`);
                attentionList.push(attAlert);
            }
        }

        console.log(`Total Alerts: ${attentionList.length}`);

    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
};

run();
