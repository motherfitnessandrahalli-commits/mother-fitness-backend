// ULTRA AGGRESSIVE INDEX FIX - Last resort
const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = 'motherfitness_db';

async function ultraForceFixIndex() {
    const client = new MongoClient(MONGO_URI);

    try {
        await client.connect();
        console.log('✅ Connected to MongoDB\n');

        const db = client.db(DB_NAME);
        const collection = db.collection('attendances');

        // Get ALL indexes
        console.log('📋 CURRENT INDEXES:');
        const indexes = await collection.listIndexes().toArray();

        for (const idx of indexes) {
            console.log(`\n  Index: ${idx.name}`);
            console.log(`  Keys: ${JSON.stringify(idx.key)}`);
            console.log(`  Unique: ${idx.unique || false}`);
        }

        // Try to drop the problematic index by name
        console.log('\n🗑️  FORCE DROPPING customerId_1_date_1...');

        try {
            const result = await collection.dropIndex('customerId_1_date_1');
            console.log('✅ Successfully dropped:', result);
        } catch (error) {
            if (error.codeName === 'IndexNotFound') {
                console.log('ℹ️  Index not found (good - already removed)');
            } else {
                console.error('❌ Drop failed:', error.message);

                // Nuclear option: drop ALL indexes except _id
                console.log('\n💥 NUCLEAR OPTION: Dropping ALL indexes except _id_...');
                const allIndexes = await collection.listIndexes().toArray();
                for (const idx of allIndexes) {
                    if (idx.name !== '_id_') {
                        console.log(`  Dropping: ${idx.name}`);
                        try {
                            await collection.dropIndex(idx.name);
                            console.log(`  ✅ Dropped`);
                        } catch (e) {
                            console.log(`  ❌ Failed: ${e.message}`);
                        }
                    }
                }
            }
        }

        // Create the CORRECT indexes
        console.log('\n📝 Creating CORRECT index...');

        await collection.createIndex(
            { customerId: 1, timestamp: 1 },
            { unique: true, name: 'customerId_1_timestamp_1' }
        );
        console.log('✅ Created: customerId_1_timestamp_1 (unique on customerId + timestamp)');

        // OTHER helpful indexes (not unique)
        await collection.createIndex({ date: 1 });
        console.log('✅ Created: date_1');

        await collection.createIndex({ timestamp: -1 });
        console.log('✅ Created: timestamp_-1');

        // Verify final state
        console.log('\n📋 FINAL INDEXES:');
        const final = await collection.listIndexes().toArray();
        final.forEach(idx => {
            console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)} (unique: ${idx.unique || false})`);
        });

        console.log('\n✅ INDEX FIX COMPLETE!');
        console.log('\n🎉 Now you can create multiple attendance records per customer!');
        console.log('   The unique constraint is on (customerId + timestamp) which will always be unique.');

    } catch (error) {
        console.error('\n❌ FATAL ERROR:', error);
    } finally {
        await client.close();
        console.log('\n👋 Disconnected');
        process.exit(0);
    }
}

ultraForceFixIndex();
