const https = require('https');

const API_HOST = 'mother-fitness-backend.onrender.com';
const MEMBER_ID = 'U007';
const PASSWORD = 'pass12345';

async function check() {
    const login = await makeRequest('/api/member/login', 'POST', JSON.stringify({ memberId: MEMBER_ID, password: PASSWORD }));
    const token = login.data.token;
    const profile = login.data.customer;

    console.log('Logged in ID:', profile._id);

    const payRes = await makeRequest('/api/member/payments', 'GET', null, token);
    console.log('API Status:', payRes.status);
    console.log('Data Object Keys:', Object.keys(payRes.data || {}));
    console.log('Payments Count:', payRes.data?.payments?.length);

    if (payRes.data?.payments?.length > 0) {
        const p = payRes.data.payments[0];
        console.log('First Payment:', {
            id: p._id,
            customerId: p.customerId,
            amount: p.amount,
            plan: p.planType
        });

        console.log('IDs match?', p.customerId === profile._id);
    }
}

function makeRequest(path, method, body, token) {
    return new Promise((resolve) => {
        const options = {
            hostname: API_HOST,
            path: path,
            method: method,
            headers: { 'Content-Type': 'application/json' }
        };
        if (token) options.headers['Authorization'] = `Bearer ${token}`;
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', d => data += d);
            res.on('end', () => resolve(JSON.parse(data)));
        });
        if (body) req.write(body);
        req.end();
    });
}

check();
