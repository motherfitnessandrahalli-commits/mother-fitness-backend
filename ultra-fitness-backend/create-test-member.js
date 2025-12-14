const mongoose = require('mongoose');
const dotenv = require('dotenv');
const { Customer } = require('./src/models');

// Load env vars
dotenv.config();

const createTestMember = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Check if U001 exists
        const existing = await Customer.findOne({ memberId: 'U001' });
        if (existing) {
            console.log('ℹ️ Test member U001 already exists. Updating password...');
            existing.password = 'password123';
            existing.isFirstLogin = true;
            await existing.save();
            console.log('✅ Password updated to: password123');
        } else {
            console.log('ℹ️ Creating new test member...');
            const member = await Customer.create({
                name: 'Test Member',
                email: 'member@test.com',
                phone: '9876543210',
                age: 25,
                plan: 'Monthly',
                validity: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
                memberId: 'U001',
                password: 'password123',
                isFirstLogin: true
            });
            console.log('✅ Created test member: U001 / password123');
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
};

createTestMember();
