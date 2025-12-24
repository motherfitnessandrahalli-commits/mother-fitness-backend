// FINAL FIX - Drop the exact problematic index
const { MongoClient } = require('mongodb');

const MONGO_URI = 'mongodb://localhost:27017';

async function finalFix() {
    const client = new MongoClient(MONGO_URI);

    try {
        await client.connect();
        console.log('✅ Connected\n');

        const db = client.db('motherfitness_db');
        const collection = db.collection('attendances');

        console.log('🗑️  Dropping: customerId_1_date_1_type_1_timestamp');

        try {
            await collection.dropIndex('customerId_1_date_1_type_1_timestamp');
            console.log('✅ DROPPED!\n');
        } catch (e) {
            console.log('Already gone or:', e.message, '\n');
        }

        console.log('📝 Creating new simple index: customerId_1_timestamp_1');
        await collection.createIndex(
            { customerId: 1, timestamp: 1 },
            { unique: true }
        );
        console.log('✅ CREATED!\n');

        console.log('📋 Final indexes:');
        const all = await collection.listIndexes().toArray();
        all.forEach(idx => {
            const unique = idx.unique ? ' [UNIQUE]' : '';
            console.log(`  ${idx.name}${unique}`);
        });

        console.log('\n🎉 FIXED! You can now have multiple IN/OUT per day!');

    } finally {
        await client.close();
        process.exit(0);
    }
}

finalFix();
