// Create test member U011 for biometric testing
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/motherfitness_db';

async function createU011() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('✅ Connected to MongoDB\n');

        // Define schema
        const customerSchema = new mongoose.Schema({
            name: String,
            memberId: String,
            email: String,
            phone: String,
            age: Number,
            plan: String,
            validity: Date,
            status: String,
            isInside: Boolean,
            profilePhoto: String,
            createdAt: Date,
            lastActivity: Date,
            totalVisits: Number
        });

        const Customer = mongoose.models.Customer || mongoose.model('Customer', customerSchema);

        // Check if U011 already exists
        const existing = await Customer.findOne({ memberId: 'U011' });
        if (existing) {
            console.log('ℹ️  Member U011 already exists:');
            console.log('   Name:', existing.name);
            console.log('   isInside:', existing.isInside);
            console.log('   Validity:', existing.validity);
            console.log('\n✅ No action needed');
            process.exit(0);
        }

        // Create U011 with active membership
        const validity = new Date();
        validity.setDate(validity.getDate() + 30); // 30 days from now

        const newMember = await Customer.create({
            name: 'Test User U011',
            memberId: 'U011',
            email: 'u011@test.com',
            phone: '+91 9876543211',
            age: 25,
            plan: 'Monthly',
            validity: validity,
            status: 'active',
            isInside: false,
            totalVisits: 0,
            createdAt: new Date(),
            lastActivity: new Date()
        });

        console.log('✅ Created test member U011:');
        console.log('   Name:', newMember.name);
        console.log('   Member ID:', newMember.memberId);
        console.log('   Validity:', newMember.validity);
        console.log('   Status:', newMember.status);
        console.log('   isInside:', newMember.isInside);

        console.log('\n🎉 Member U011 is ready for biometric testing!');
        console.log('\nYou can now test in Postman:');
        console.log('POST http://localhost:5000/api/biometric/mock');
        console.log('Body: { "user_id": "U011", "direction": "IN" }');

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

createU011();
