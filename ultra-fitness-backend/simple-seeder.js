require('dotenv').config();
const mongoose = require('mongoose');
const { User, Customer, Attendance } = require('./src/models');

const seed = async () => {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected!');

        console.log('Clearing database...');
        await User.deleteMany({});
        await Customer.deleteMany({});
        await Attendance.deleteMany({});

        console.log('Creating users...');
        const user = await User.create({
            email: 'admin@ultrafitness.com',
            password: '0000',
            name: 'Admin User',
            role: 'admin'
        });
        console.log('User created:', user._id);

        console.log('Creating customer...');
        const customer = await Customer.create({
            customerId: 'cust_' + Date.now(),
            name: 'Test Customer',
            age: 25,
            email: 'test@example.com',
            phone: '1234567890',
            plan: 'Monthly',
            validity: new Date(),
            createdBy: user._id
        });
        console.log('Customer created:', customer._id);

        console.log('Done!');
        process.exit(0);
    } catch (error) {
        console.error('ERROR:', error.message);
        if (error.errors) {
            Object.keys(error.errors).forEach(key => {
                console.error(`Validation Error [${key}]:`, error.errors[key].message);
            });
        }
        console.error('Full Error:', error);
        process.exit(1);
    }
};

seed();
