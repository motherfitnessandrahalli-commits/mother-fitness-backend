const axios = require('axios');
const mongoose = require('mongoose');
const Customer = require('../src/models/Customer');
require('dotenv').config();

const CLOUD_URL = process.env.CLOUD_API_URL;
const MONGO_URI = process.env.MONGODB_URI;

async function run() {
    try {
        console.log('🔌 Connecting to Local DB...');
        await mongoose.connect(MONGO_URI);
        const localInside = await Customer.find({ isInside: true });
        const localIds = localInside.map(c => c.memberId);
        console.log('🏠 LOCAL INSIDE:', localInside.map(c => `${c.name} (${c.memberId})`));

        console.log('☁️ Logging in to Cloud as Admin...');
        let token;
        try {
            const login = await axios.post(CLOUD_URL + '/api/auth/login', {
                email: 'admin@motherfitness.com',
                password: '0000'
            });
            token = login.data.token;
            console.log('✅ Admin Login Success');
        } catch (e) {
            console.error('❌ Admin Login Failed:', e.message);
            // Try fallback password if 0000 fails
            try {
                console.log('🔄 Retrying with 111111...');
                const login = await axios.post(CLOUD_URL + '/api/auth/login', {
                    email: 'admin@motherfitness.com',
                    password: '111111'
                });
                token = login.data.token;
                console.log('✅ Admin Login Success (111111)');
            } catch (e2) {
                console.error('❌ Admin Login Failed (111111):', e2.message);
                return;
            }
        }

        console.log('☁️ Fetching Cloud Customers...');
        // We need to fetch all because there is no /access/live-members endpoint exposed easily via API yet without correct route
        // But since we are admin, we can query customers?
        // Wait, getCustomers endpoint has filters!
        // We can't filter by "isInside" easily via query params in the controller unless added.
        // Let's fetch all (paged) or just use the sync key trick? 
        // No, we use the token to update.

        // Actually, we can just "Sync" the local status again for EVERYONE is safer?
        // No, we want to find the ghost.

        // Let's fetching all customers... limit 1000
        const cloudRes = await axios.get(CLOUD_URL + '/api/customers?limit=1000', {
            headers: { Authorization: 'Bearer ' + token }
        });

        const cloudCustomers = cloudRes.data.data.customers;
        const cloudInside = cloudCustomers.filter(c => c.isInside);
        console.log('☁️ CLOUD INSIDE:', cloudInside.map(c => `${c.name} (${c.memberId})`));

        // Find Ghosts
        const ghosts = cloudInside.filter(c => !localIds.includes(c.memberId));

        if (ghosts.length === 0) {
            console.log('✨ No Ghosts found! Counts should match.');
        } else {
            console.log('👻 GHOSTS FOUND:', ghosts.map(c => c.name));

            for (const ghost of ghosts) {
                console.log(`🔫 Fixing Ghost: ${ghost.name}...`);
                try {
                    // Update cloud record directly
                    await axios.put(CLOUD_URL + '/api/customers/' + ghost._id,
                        { isInside: false },
                        { headers: { Authorization: 'Bearer ' + token } }
                    );
                    console.log('✅ Ghost Busted!');
                } catch (e) {
                    console.error('❌ Failed to fix ghost:', e.message);
                }
            }
        }

    } catch (error) {
        console.error('💥 Error:', error.message);
    } finally {
        await mongoose.disconnect();
    }
}

run();
