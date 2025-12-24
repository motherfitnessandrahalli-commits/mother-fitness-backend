// FORCE FIX for attendance index - more aggressive approach
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/motherfitness_db';

async function forceFixIndex() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('✅ Connected to MongoDB\n');

        const db = mongoose.connection.db;
        const collection = db.collection('attendances');

        // List ALL current indexes
        console.log('📋 ALL Current indexes:');
        const indexes = await collection.listIndexes().toArray();
        indexes.forEach(idx => {
            console.log(`  - ${idx.name}`);
            console.log(`    Keys:`, idx.key);
            console.log(`    Unique:`, idx.unique || false);
            console.log('');
        });

        // Drop ALL indexes except _id_
        console.log('🗑️  Dropping all custom indexes...\n');
        for (const idx of indexes) {
            if (idx.name !== '_id_') {
                try {
                    console.log(`  Dropping: ${idx.name}`);
                    await collection.dropIndex(idx.name);
                    console.log(`  ✅ Dropped: ${idx.name}`);
                } catch (error) {
                    console.error(`  ❌ Failed to drop ${idx.name}:`, error.message);
                }
            }
        }

        console.log('\n📝 Creating correct indexes...\n');

        // 1. Unique compound index (allows multiple IN/OUT per day)
        await collection.createIndex(
            { customerId: 1, date: 1, type: 1, timestamp: 1 },
            { unique: true }
        );
        console.log('✅ Created: customerId_1_date_1_type_1_timestamp_1 (unique)');

        // 2. Date index for faster queries
        await collection.createIndex({ date: 1 });
        console.log('✅ Created: date_1');

        // 3. Timestamp index for sorting
        await collection.createIndex({ timestamp: -1 });
        console.log('✅ Created: timestamp_-1');

        // 4. Membership status index
        await collection.createIndex({ membershipStatus: 1 });
        console.log('✅ Created: membershipStatus_1');

        // Show final state
        console.log('\n📋 FINAL indexes:');
        const finalIndexes = await collection.listIndexes().toArray();
        finalIndexes.forEach(idx => {
            console.log(`  - ${idx.name}`);
            console.log(`    Keys:`, idx.key);
            console.log(`    Unique:`, idx.unique || false);
            console.log('');
        });

        console.log('✅ INDEX FIX COMPLETE!');
        console.log('\n🎉 You can now create multiple IN/OUT attendance records per day!');
        console.log('   Try your Postman request again.');

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n👋 Disconnected');
        process.exit(0);
    }
}

forceFixIndex();
