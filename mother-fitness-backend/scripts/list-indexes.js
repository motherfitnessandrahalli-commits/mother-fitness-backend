// Simple script to just list current indexes
const { MongoClient } = require('mongodb');

const MONGO_URI = 'mongodb://localhost:27017';

async function listIndexes() {
    const client = new MongoClient(MONGO_URI);

    try {
        await client.connect();
        const db = client.db('motherfitness_db');
        const collection = db.collection('attendances');

        console.log('\n📋 ATTENDANCE COLLECTION INDEXES:\n');
        const indexes = await collection.listIndexes().toArray();

        indexes.forEach(idx => {
            console.log(`✓ ${idx.name}`);
            console.log(`  Keys: ${JSON.stringify(idx.key)}`);
            console.log(`  Unique: ${idx.unique || false}\n`);
        });

    } finally {
        await client.close();
        process.exit(0);
    }
}

listIndexes();
