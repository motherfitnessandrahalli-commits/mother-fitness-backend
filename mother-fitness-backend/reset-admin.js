const mongoose = require('mongoose');
require('dotenv').config();
const { User } = require('./src/models');

const resetAdmin = async () => {
    try {
        console.log('Connecting to MongoDB...');
        // Ensure we have a URI
        if (!process.env.MONGODB_URI) {
            throw new Error('MONGODB_URI is not defined in .env');
        }

        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to database.');

        const email = 'admin@motherfitness.com';
        const password = '111111';

        let user = await User.findOne({ email });

        if (user) {
            console.log('Admin user found. Updating password...');
            user.password = password;
            // Ensure role is admin
            user.role = 'admin';
            user.isActive = true;
            await user.save();
            console.log('Password updated successfully.');
        } else {
            console.log('Admin user not found. Creating new admin user...');
            user = await User.create({
                email,
                password,
                name: 'Admin User',
                role: 'admin',
                isActive: true
            });
            console.log('Admin user created successfully.');
        }

        console.log('Credentials:');
        console.log(`Email: ${email}`);
        console.log(`Password: ${password}`);

        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
};

resetAdmin();
