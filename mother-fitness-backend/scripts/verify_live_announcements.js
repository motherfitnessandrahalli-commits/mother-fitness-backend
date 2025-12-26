const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');

async function run() {
    try {
        console.log('📢 Testing Announcement Sync...');

        await mongoose.connect(process.env.MONGODB_URI);
        const { Announcement } = require('../src/models');
        const { syncAnnouncement } = require('../src/services/SyncService');

        // 1. Create locally
        const testTitle = 'Live Test ' + new Date().getTime();
        const a = await Announcement.create({
            title: testTitle,
            content: 'Verification of live sync at ' + new Date().toISOString(),
            type: 'INFO',
            isActive: true,
            expiresAt: new Date(Date.now() + 86400000)
        });
        console.log('✅ Created Local Announcement:', a.title);

        // 2. Wait for SyncService (or trigger manually if we can)
        // Actually, the controller calls SyncService.syncAnnouncement(announcement)
        // I'll call it manually here to be sure.
        const SyncService = require('../src/services/SyncService');
        await SyncService.init();
        await SyncService.syncAnnouncement(a);

        console.log('⏳ Waiting 5 seconds for Push to Cloud...');
        await new Promise(r => setTimeout(r, 5000));

        // 3. Check Cloud
        const cloudConn = await mongoose.createConnection(process.env.CLOUD_MONGODB_URI).asPromise();
        const CloudAnnouncement = cloudConn.model('Announcement', new mongoose.Schema({}, { strict: false }));

        const found = await CloudAnnouncement.findOne({ title: testTitle });
        if (found) {
            console.log('🎉 FOUND IN CLOUD! Sync Working.');
        } else {
            console.log('❌ NOT FOUND IN CLOUD.');
        }

        await mongoose.disconnect();
        await cloudConn.close();
        process.exit();

    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

run();
