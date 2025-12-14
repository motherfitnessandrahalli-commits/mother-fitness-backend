require('dotenv').config();
const mongoose = require('mongoose');
const { User, Customer, Attendance } = require('../models');
const logger = require('../config/logger');

// Sample data
const sampleUsers = [
    {
        email: 'admin@motherfitness.com',
        password: '111111',
        name: 'Admin User',
        role: 'admin',
    },
    {
        email: 'staff@ultrafitness.com',
        password: '0000',
        name: 'Staff Member',
        role: 'staff',
    },
];

const sampleCustomers = [
    {
        name: 'Rajesh Kumar',
        age: 28,
        email: 'rajesh.kumar@email.com',
        phone: '+91 98765 43210',
        plan: 'Yearly',
        validity: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000), // 180 days from now
        notes: 'Morning batch preferred',
    },
    {
        name: 'Priya Sharma',
        age: 24,
        email: 'priya.sharma@email.com',
        phone: '+91 87654 32109',
        plan: 'Quarterly',
        validity: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now (expiring)
        notes: 'Interested in yoga classes',
    },
    {
        name: 'Amit Patel',
        age: 35,
        email: 'amit.patel@email.com',
        phone: '+91 76543 21098',
        plan: 'Monthly',
        validity: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago (expired)
        notes: 'Needs renewal reminder',
    },
    {
        name: 'Sneha Reddy',
        age: 30,
        email: 'sneha.reddy@email.com',
        phone: '+91 65432 10987',
        plan: 'Half-Yearly',
        validity: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days from now
        notes: 'Evening sessions only',
    },
];

const seedDatabase = async () => {
    try {
        // Connect to database
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });

        logger.info('Connected to MongoDB for seeding');

        // Clear existing data
        await User.deleteMany({});
        await Customer.deleteMany({});
        await Attendance.deleteMany({});
        logger.info('Cleared existing data');

        // Create users
        const createdUsers = await User.create(sampleUsers);
        logger.info(`Created ${createdUsers.length} users`);

        // Create customers (assign to first user)
        const customersWithCreator = sampleCustomers.map(customer => ({
            ...customer,
            customerId: 'cust_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            createdBy: createdUsers[0]._id,
        }));
        const createdCustomers = await Customer.create(customersWithCreator);
        logger.info(`Created ${createdCustomers.length} customers`);

        // Create some sample attendance records
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        const timeStr = today.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

        const sampleAttendance = [
            {
                attendanceId: 'att_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                customerId: createdCustomers[0]._id,
                customerName: createdCustomers[0].name,
                date: todayStr,
                time: timeStr,
                timestamp: today,
                membershipStatus: 'active',
                markedBy: createdUsers[1]._id,
            },
            {
                attendanceId: 'att_' + (Date.now() + 1) + '_' + Math.random().toString(36).substr(2, 9),
                customerId: createdCustomers[1]._id,
                customerName: createdCustomers[1].name,
                date: todayStr,
                time: timeStr,
                timestamp: today,
                membershipStatus: 'expiring',
                markedBy: createdUsers[1]._id,
            },
        ];

        const createdAttendance = await Attendance.create(sampleAttendance);
        logger.info(`Created ${createdAttendance.length} attendance records`);

        logger.info('✅ Database seeded successfully!');
        logger.info('\nSample Login Credentials:');
        logger.info('Admin - Email: admin@motherfitness.com, Password: 111111');
        logger.info('Staff - Email: staff@ultrafitness.com, Password: 0000');

        process.exit(0);
    } catch (error) {
        logger.error(`Error seeding database: ${error.message}`);
        if (error.errors) {
            Object.keys(error.errors).forEach(key => {
                logger.error(`Validation Error [${key}]: ${error.errors[key].message}`);
            });
        }
        process.exit(1);
    }
};

// Run seeder
seedDatabase();
