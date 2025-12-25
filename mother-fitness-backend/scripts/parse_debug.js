const fs = require('fs');
const content = fs.readFileSync('full_response_inspect.txt', 'utf8');

// Extract lines between FULL PAYMENTS RESPONSE and end
const startMarker = '--- FULL PAYMENTS RESPONSE ---';
const jsonPart = content.split(startMarker)[1];

try {
    const data = JSON.parse(jsonPart);
    console.log('API Status:', data.status);
    console.log('Payments Count:', data.data.payments.length);
    console.log('Debug Version:', data.data.debug_version);

    if (data.data.payments.length > 0) {
        console.log('First Payment CustomerID:', data.data.payments[0].customerId);
    }
} catch (e) {
    console.log('Failed to parse JSON part');
    console.log('Raw JSON Part start:', jsonPart.trim().substring(0, 500));
}
