// Script to fix the duplicate attendance index issue
// This drops the old incorrect index and ensures the correct one exists

const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/motherfitness_db';

async function fixAttendanceIndex() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('✅ Connected to MongoDB\n');

        const db = mongoose.connection.db;
        const collection = db.collection('attendances');

        // List current indexes
        console.log('📋 Current indexes:');
        const indexes = await collection.indexes();
        indexes.forEach(idx => {
            console.log(`  - ${idx.name}:`, JSON.stringify(idx.key));
        });

        // Drop the problematic old index (customerId_1_date_1)
        try {
            console.log('\n🗑️  Dropping old index: customerId_1_date_1');
            await collection.dropIndex('customerId_1_date_1');
            console.log('✅ Old index dropped');
        } catch (error) {
            if (error.codeName === 'IndexNotFound') {
                console.log('ℹ️  Index customerId_1_date_1 not found (already removed)');
            } else {
                console.warn('⚠️  Could not drop index:', error.message);
            }
        }

        // Create the correct compound index
        console.log('\n📝 Creating correct index: customerId_1_date_1_type_1_timestamp_1');
        await collection.createIndex(
            { customerId: 1, date: 1, type: 1, timestamp: 1 },
            { unique: true, name: 'customerId_1_date_1_type_1_timestamp_1' }
        );
        console.log('✅ Correct index created');

        // Show final indexes
        console.log('\n📋 Final indexes:');
        const finalIndexes = await collection.indexes();
        finalIndexes.forEach(idx => {
            console.log(`  - ${idx.name}:`, JSON.stringify(idx.key));
        });

        console.log('\n✅ Index fix complete!');
        console.log('Now you can create multiple IN/OUT records per day per customer.');

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n👋 Disconnected from MongoDB');
    }
}

fixAttendanceIndex();
