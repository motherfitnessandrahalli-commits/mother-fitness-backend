const mongoose = require('mongoose');
const AdminProfile = require('../src/models/AdminProfile');
require('dotenv').config();

const checkAdminAccess = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to DB');

        const profile = await AdminProfile.findOne();
        console.log('📄 Admin Profile Found:', JSON.stringify(profile, null, 2));

        if (!profile) {
            console.log('❌ No Admin Profile found!');
            return;
        }

        const testId = 'U002';
        const hasAccess = profile.memberIds && profile.memberIds.includes(testId);

        console.log(`\n🔍 Checking Access for '${testId}':`);
        console.log(`- Member IDs: ${JSON.stringify(profile.memberIds)}`);
        console.log(`- Access Granted? ${hasAccess ? '✅ YES' : '❌ NO'}`);

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

checkAdminAccess();
