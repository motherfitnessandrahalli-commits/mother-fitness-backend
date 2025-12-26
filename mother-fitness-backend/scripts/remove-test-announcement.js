const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const { Announcement } = require('../src/models');

async function run() {
    try {
        console.log('🧹 Starting cleanup for test announcement...');

        // 1. Connect Local
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to Local DB');

        const { Announcement } = require('../src/models');
        const testTitle = 'TEST ANNOUNCEMENT 1766651912400';

        // Delete Local
        const localResult = await Announcement.deleteMany({
            title: { $regex: 'TEST ANNOUNCEMENT 1766651912400', $options: 'i' }
        });
        console.log(`🗑️ Local DB: Deleted ${localResult.deletedCount} announcements.`);

        // 2. Connect Cloud
        if (!process.env.CLOUD_MONGODB_URI) {
            console.error('❌ CLOUD_MONGODB_URI not found in .env');
        } else {
            console.log('🔄 Connecting to Cloud DB...');
            const cloudConn = await mongoose.createConnection(process.env.CLOUD_MONGODB_URI).asPromise();
            console.log('✅ Connected to Cloud DB');

            const CloudAnnouncement = cloudConn.model('Announcement', new mongoose.Schema({}, { strict: false }));

            // Delete Cloud
            const cloudResult = await CloudAnnouncement.deleteMany({
                title: { $regex: 'TEST ANNOUNCEMENT 1766651912400', $options: 'i' }
            });
            console.log(`🗑️ Cloud DB: Deleted ${cloudResult.deletedCount} announcements.`);

            await cloudConn.close();
        }

        await mongoose.disconnect();
        console.log('✨ Cleanup complete.');
        process.exit(0);

    } catch (error) {
        console.error('❌ Error during cleanup:', error.message);
        process.exit(1);
    }
}

run();
