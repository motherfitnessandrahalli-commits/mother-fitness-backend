// ABSOLUTELY FINAL FIX - Delete ALL attendance data and rebuild indexes
const { MongoClient } = require('mongodb');

const MONGO_URI = 'mongodb://localhost:27017';

async function nuclearFix() {
    const client = new MongoClient(MONGO_URI);

    try {
        await client.connect();
        console.log('✅ Connected to MongoDB\n');

        const db = client.db('motherfitness_db');
        const collection = db.collection('attendances');

        // Show current state
        console.log('📋 Current indexes:');
        const current = await collection.listIndexes().toArray();
        current.forEach(idx => {
            console.log(`  ${idx.name}: ${JSON.stringify(idx.key)} (unique: ${idx.unique || false})`);
        });

        // Count current documents
        const count = await collection.countDocuments();
        console.log(`\n📊 Current documents: ${count}`);

        console.log('\n💥 NUCLEAR OPTION: Dropping entire collection...');
        await collection.drop();
        console.log('✅ Collection dropped!');

        console.log('\n📝 Recreating collection with correct indexes...');

        // Collection will be auto-created on first insert, but let's create indexes now
        const newCollection = db.collection('attendances');

        // Only create ONE unique index: customerId + timestamp
        await newCollection.createIndex(
            { customerId: 1, timestamp: 1 },
            { unique: true, name: 'customerId_timestamp_unique' }
        );
        console.log('✅ Created: customerId_timestamp_unique (allows multiple per day)');

        // Helpful non-unique indexes
        await newCollection.createIndex({ date: 1 });
        console.log('✅ Created: date_1');

        await newCollection.createIndex({ timestamp: -1 });
        console.log('✅ Created: timestamp_-1');

        console.log('\n📋 Final indexes:');
        const final = await newCollection.listIndexes().toArray();
        final.forEach(idx => {
            console.log(`  ${idx.name}: ${JSON.stringify(idx.key)} (unique: ${idx.unique || false})`);
        });

        console.log('\n🎉 COMPLETE! Attendance collection rebuilt with correct indexes.');
        console.log('⚠️  NOTE: All previous attendance data has been deleted.');
        console.log('✅ You can now create unlimited IN/OUT records per customer per day!');

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await client.close();
        process.exit(0);
    }
}

nuclearFix();
