const https = require('https');

// Config
const API_HOST = 'mother-fitness-backend.onrender.com';
const MEMBER_ID = 'U007'; // The user we are debugging
const PASSWORD = 'password123'; // Standard default, or we presume from context (User said U007, usually simple pass)
// Wait, in previous turn I used `memberId` to find them locally, but for login I need password.
// In `resolve_and_recreate.js`, I used:
// const LOGIN_BODY = JSON.stringify({ email: "bevarshi@gmail.com", password: "password" }); (Hypothetically)
// actually I didn't verify the password in previous turns.
// Let's try to find the password from the LOCAL DB first to ensure I can login.

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const Customer = require('../src/models/Customer');

async function probe() {
    try {
        console.log('🔍 Probing Live API...');

        // 1. Credentials (Hardcoded from User)
        const LOGIN_BODY = JSON.stringify({
            memberId: 'U007',
            password: 'pass12345'
        });

        // 2. Login to Live API
        console.log('🔐 Logging in to Live API with U007 / pass12345 ...');
        const token = await makeRequest('/api/member/login', 'POST', LOGIN_BODY);

        if (!token || !token.token) {
            console.error('❌ Login Failed:', token);
            process.exit(1);
        }
        console.log('✅ Login Successful. Token obtained.');
        console.log(`   User ID in Token: ${token.customer?.id || token.user?.id || '?'}`);

        // 3. Fetch Payments
        console.log('💸 Fetching Payments...');
        const paymentRes = await makeRequest('/api/member/payments', 'GET', null, token.token);

        console.log('\n--- API RESPONSE ---');
        console.log('Debug Version:', paymentRes.debug_version || 'Undefined (Old Code!)');
        console.log('Total Payments:', paymentRes.total);
        console.log('Payments Array Length:', paymentRes.payments?.length);

        if (paymentRes.payments?.length > 0) {
            console.log('✅ PAYMENTS EXIST in API Response!');
            const firstPayment = paymentRes.payments[0];
            console.log('First Payment:', firstPayment);

            // 4. Try Download
            console.log(`\n📥 Attempting to Download Receipt for ${firstPayment._id}...`);
            await makeRequest(`/api/member/payments/${firstPayment._id}/receipt`, 'GET', null, token.token);
            console.log('✅ Receipt Download Request Completed (Check Status below).');
        } else {
            console.log('❌ Payments List is EMPTY in API Response.');
        }

    } catch (error) {
        console.error('❌ Probe Failed:', error.message);
    }
}

function makeRequest(path, method, body, token) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: API_HOST,
            port: 443,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json',
            }
        };

        if (token) {
            options.headers['Authorization'] = `Bearer ${token}`;
        }
        if (body) {
            options.headers['Content-Length'] = Buffer.byteLength(body);
        }

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    // Don't auto-parse here, let logic inside handle it
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        // If it's a PDF (binary), just say success
                        if (res.headers['content-type'] === 'application/pdf') {
                            console.log('✅ RESPONSE IS PDF! (Binary data received)');
                            resolve({ success: true, message: 'PDF Received' });
                        } else {
                            try {
                                const parsed = JSON.parse(data);
                                resolve(parsed.data || parsed);
                            } catch (e) {
                                // Maybe valid text response?
                                console.log('Response (Not JSON):', data.substring(0, 100));
                                resolve(data);
                            }
                        }
                    } else {
                        console.error(`❌ API Error (${res.statusCode})`);
                        try {
                            const parsed = JSON.parse(data);
                            console.error('Error Body:', parsed);
                            resolve(parsed);
                        } catch (e) {
                            console.error('Error Body (Raw):', data);
                            resolve(data);
                        }
                    }
                } catch (e) {
                    reject(e);
                }
            });
        });

        req.on('error', reject);
        if (body) req.write(body);
        req.end();
    });
}

probe();
