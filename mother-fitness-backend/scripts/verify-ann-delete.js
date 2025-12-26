const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

async function verifyAnnouncementDeletion() {
    try {
        const localConn = await mongoose.connect(process.env.MONGODB_URI);
        const cloudConn = await mongoose.createConnection(process.env.CLOUD_MONGODB_URI).asPromise();

        console.log('--- ANNOUNCEMENT DELETION VERIFICATION ---');

        // 1. Create a test announcement locally
        const Announcement = require('../src/models/Announcement');
        const syncService = require('../src/services/SyncService');
        await syncService.init();

        const testAnn = await Announcement.create({
            title: 'SYNC_TEST_DELETE_ME',
            message: 'Testing cloud deletion',
            startDate: new Date(),
            endDate: new Date(Date.now() + 86400000),
            type: 'info',
            createdBy: new mongoose.Types.ObjectId()
        });

        console.log(`✅ Created test announcement: ${testAnn._id}`);

        // 2. Wait for sync
        console.log('⏳ Waiting for sync push...');
        await syncService.syncAnnouncement(testAnn);
        await new Promise(r => setTimeout(r, 3000));

        // 3. Verify in Cloud
        let cloudAnn = await cloudConn.collection('announcements').findOne({ localId: testAnn._id.toString() });
        if (cloudAnn) {
            console.log('✅ Found in Cloud.');
        } else {
            console.log('❌ NOT found in Cloud after creation.');
        }

        // 4. Delete Locally & Trigger Sync
        console.log('🗑️ Deleting announcement...');
        await syncService.syncAnnouncementDelete(testAnn._id);
        await testAnn.deleteOne();

        // 5. Wait for sync deletion
        console.log('⏳ Waiting for sync deletion...');
        await new Promise(r => setTimeout(r, 3000));

        // 6. Verify Cloud Deletion
        cloudAnn = await cloudConn.collection('announcements').findOne({ localId: testAnn._id.toString() });
        if (!cloudAnn) {
            console.log('🎉 SUCCESS: Announcement removed from Cloud!');
        } else {
            console.log('❌ FAILURE: Announcement still exists in Cloud.');
        }

    } catch (err) {
        console.error(err);
    } finally {
        process.exit(0);
    }
}

verifyAnnouncementDeletion();
