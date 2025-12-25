const https = require('https');

const API_HOST = 'mother-fitness-backend.onrender.com';
const MEMBER_ID = 'U007';
const PASSWORD = 'pass12345';

async function check() {
    try {
        console.log(`🔐 Logging in as ${MEMBER_ID}...`);
        const fullLoginRes = await makeRequest('/api/member/login', 'POST', JSON.stringify({ memberId: MEMBER_ID, password: PASSWORD }));
        const loginData = fullLoginRes.data;

        if (!loginData || !loginData.token) {
            console.error('❌ Login failed!', fullLoginRes);
            return;
        }

        console.log('✅ Login success.');
        const profileId = loginData.customer?._id || loginData.customer?.id;
        console.log('Profile ID:', profileId);

        console.log('💸 Fetching payments...');
        const res = await makeRequest('/api/member/payments', 'GET', null, loginData.token);

        console.log('\n--- FULL PAYMENTS RESPONSE ---');
        console.log(JSON.stringify(res, null, 2));

    } catch (e) {
        console.error(e);
    }
}

function makeRequest(path, method, body, token) {
    return new Promise((resolve) => {
        const options = {
            hostname: API_HOST,
            port: 443,
            path: path,
            method: method,
            headers: { 'Content-Type': 'application/json' }
        };
        if (token) options.headers['Authorization'] = `Bearer ${token}`;

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', d => data += d);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (err) {
                    console.error('Parse Error:', data);
                    resolve({ error: 'Parse Error', raw: data });
                }
            });
        });
        req.on('error', e => console.error(e));
        if (body) req.write(body);
        req.end();
    });
}

check();
