const mongoose = require('mongoose');
const dotenv = require('dotenv');
const logger = require('../src/config/logger');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

async function checkDatabase() {
    console.log('--- Database Debug Script ---');

    // 1. Check Connection String (masked)
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.error('❌ MONGODB_URI is not defined in .env');
        process.exit(1);
    }

    const isCloud = uri.includes('mongodb.net');
    const isLocal = uri.includes('localhost') || uri.includes('127.0.0.1');

    console.log(`📡 Defined URI Type: ${isCloud ? 'CLOUD (Atlas)' : isLocal ? 'LOCAL' : 'UNKNOWN'}`);

    if (isCloud) {
        console.log('⚠️  WARNING: You are connected to the CLOUD database. This might contain old data including test users.');
    } else {
        console.log('✅ Connected to LOCAL database.');
    }

    try {
        await mongoose.connect(uri);
        console.log('✅ Connected to MongoDB successfully.');

        // 2. Check for User u002
        const Customer = require('../src/models/Customer');

        console.log('🔍 Searching for user "u002"...');
        const user = await Customer.findOne({
            $or: [{ memberId: 'u002' }, { memberId: /u002/i }]
        });

        if (user) {
            console.log('❗ FOUND USER "u002":');
            console.log(`   - ID: ${user._id}`);
            console.log(`   - Name: ${user.name}`);
            console.log(`   - MemberID: ${user.memberId}`);
            console.log(`   - IsInside: ${user.isInside}`);
            console.log(`   - Status: ${user.status}`);

            if (user.isInside) {
                console.log('🚨 ALERT: This user is marked as INSIDE. Scanning them again "IN" will cause ANTI-PASSBACK BREACH.');
            }
        } else {
            console.log('✅ User "u002" NOT FOUND in this database.');
        }

    } catch (error) {
        console.error('❌ Error during check:', error);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

checkDatabase();
