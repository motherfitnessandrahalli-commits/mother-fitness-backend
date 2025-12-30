const axios = require('axios');

const testSignal = {
    "eventTime": "2025-12-04 16:43:29",
    "pin": "U001",
    "verifyModeName": "Other",
    "readerName": "Other",
    "devName": "10.10.25.26"
};

const BASE_URL = 'http://localhost:5000/api/biometric/event';

async function verifySignal() {
    try {
        console.log('🚀 Sending Test Signal to:', BASE_URL);
        console.log('📦 Payload:', JSON.stringify(testSignal, null, 2));

        const response = await axios.post(BASE_URL, testSignal);

        console.log('✅ Response Received:');
        console.log(JSON.stringify(response.data, null, 2));

        if (response.data.data === "0") {
            console.log('\n✨ VERIFICATION SUCCESSFUL: Signal processed and Door OPEN ("data": "0").');
        } else if (response.data.data === "1") {
            console.log('\n🚫 VERIFICATION: Access DENIED ("data": "1").');
        } else {
            console.log('\n❓ VERIFICATION: Unexpected "data" value:', response.data.data);
        }
    } catch (error) {
        console.error('❌ Error sending signal:', error.message);
        if (error.response) {
            console.error('Response Status:', error.response.status);
            console.error('Response Data:', error.response.data);

            if (error.response.status === 404 && error.response.data.message === 'Unknown Member') {
                console.log('\nℹ️ Note: "Unknown Member" is a valid backend response if U001 does not exist in your database.');
                console.log('This confirms the PRE-PROCESSING (mapping pin to userId) is working correctly.');
            }
        }
    }
}

verifySignal();
