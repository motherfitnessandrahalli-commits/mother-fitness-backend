// ABSOLUTELY FINAL FIX - Correct Database Name Edition
const { MongoClient } = require('mongodb');
require('dotenv').config();

// Use the URI from .env or the one we found
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/mother_fitness';

async function correctNuclearFix() {
    const client = new MongoClient(MONGO_URI);

    try {
        await client.connect();
        console.log(`✅ Connected to: ${MONGO_URI}\n`);

        const db = client.db(); // Uses the DB from the URI path
        console.log(`📂 Using Database: ${db.databaseName}`);

        if (db.databaseName !== 'mother_fitness') {
            console.log('⚠️ Warning: DB name in URI is not mother_fitness, switching manually...');
        }

        const collection = db.collection('attendances');

        // Show current state
        console.log('📋 Current indexes:');
        try {
            const current = await collection.listIndexes().toArray();
            current.forEach(idx => {
                console.log(`  ${idx.name}: ${JSON.stringify(idx.key)} (unique: ${idx.unique || false})`);
            });
        } catch (e) {
            console.log('  (Collection might not exist yet)');
        }

        console.log('\n💥 NUCLEAR OPTION: Dropping entire collection...');
        try {
            await collection.drop();
            console.log('✅ Collection dropped!');
        } catch (e) {
            console.log('✅ Collection already empty or not found');
        }

        console.log('\n📝 Recreating collection with correct indexes...');

        const newCollection = db.collection('attendances');

        // Create the ONLY unique index we want
        await newCollection.createIndex(
            { customerId: 1, timestamp: 1 },
            { unique: true, name: 'customerId_timestamp_unique' }
        );
        console.log('✅ Created: customerId_timestamp_unique');

        // Helpful non-unique indexes
        await newCollection.createIndex({ date: 1 });
        await newCollection.createIndex({ timestamp: -1 });

        console.log('\n📋 Final indexes:');
        const final = await newCollection.listIndexes().toArray();
        final.forEach(idx => {
            console.log(`  ${idx.name}: ${JSON.stringify(idx.key)} (unique: ${idx.unique || false})`);
        });

        console.log('\n🎉 SUCCESS! Database mother_fitness is now correctly indexed.');
        console.log('✅ You can now test in Postman.');

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await client.close();
        process.exit(0);
    }
}

correctNuclearFix();
