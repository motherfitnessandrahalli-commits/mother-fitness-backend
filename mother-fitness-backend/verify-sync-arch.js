/**
 * Verification Script for Hybrid Sync Architecture
 */

console.log('🔍 Verifying Sync Architecture Changes...\n');

try {
    // 1. Verify SyncQueue Model
    const SyncQueue = require('./src/models/SyncQueue');
    const enumValues = SyncQueue.schema.path('operation').enumValues;
    console.log('1️⃣ Checking SyncQueue Enums...');
    if (enumValues.includes('CREATE_PAYMENT') && enumValues.includes('UPDATE_PAYMENT')) {
        console.log('   ✅ CREATE_PAYMENT and UPDATE_PAYMENT present');
    } else {
        console.error('   ❌ Missing Enums in SyncQueue');
        console.log('   Found:', enumValues);
    }

    // 2. Verify SyncService Interval and Payload Logic
    const fs = require('fs');
    const syncServiceContent = fs.readFileSync('./src/services/SyncService.js', 'utf8');

    console.log('\n2️⃣ Checking SyncService Logic...');

    if (syncServiceContent.includes('setInterval(() => this.processQueue(), 5000)')) {
        console.log('   ✅ Interval set to 5000ms (5s)');
    } else {
        console.error('   ❌ Interval check failed');
    }

    if (syncServiceContent.includes('totalAmount: paymentData.totalAmount')) {
        console.log('   ✅ totalAmount included in sync payload');
    } else {
        console.error('   ❌ totalAmount field missing in sync logic');
    }

    // 3. Verify Frontend Login Message
    const loginHtml = fs.readFileSync('./public/member-app/index.html', 'utf8');
    console.log('\n3️⃣ Checking Member App Login...');

    if (loginHtml.includes('account might still be <b>syncing</b>')) {
        console.log('   ✅ "Syncing" message logic added to index.html');
    } else {
        console.error('   ❌ Syncing message missing in index.html');
    }

    console.log('\n✅ Verification Complete!');

} catch (error) {
    console.error('\n❌ Verification Error:', error.message);
    process.exit(1);
}
