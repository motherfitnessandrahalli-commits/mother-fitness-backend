/**
 * Verification Script for Plan Refactor
 */

console.log('🔍 Verifying Plan Refactor Changes...\n');

try {
    // 1. Verify Plans Config
    console.log('1️⃣ Checking Plans Config...');
    const { getPlan, PLANS } = require('./src/config/plans');
    const monthly = getPlan('Monthly');
    if (monthly && monthly.id === 'PLAN_MONTHLY' && monthly.amount === 800) {
        console.log('   ✅ Plans Config loaded correctly');
    } else {
        throw new Error('Plans Config invalid');
    }

    // 2. Verify Customer Model
    console.log('\n2️⃣ Checking Customer Model...');
    const Customer = require('./src/models/Customer');
    // Check if 'planName' virtual exists
    const virtuals = Customer.schema.virtuals;
    if (virtuals['planName']) {
        console.log('   ✅ Customer "planName" virtual exists');
    } else {
        console.error('   ❌ "planName" virtual missing');
    }

    // 3. Verify Sync Service logic (Static Check)
    const fs = require('fs');
    const syncServiceContent = fs.readFileSync('./src/services/SyncService.js', 'utf8');
    if (syncServiceContent.includes('plan: memberData.plan') && syncServiceContent.includes('plan: Object')) {
        console.log('\n3️⃣ SyncService: Plan Object logic found');
    } else {
        console.error('\n❌ SyncService logic missing');
    }

    // 4. Verify Application Logic (Static Check)
    const appContent = fs.readFileSync('./public/member-app/app.js', 'utf8');
    if (appContent.includes('planName') && appContent.includes('localStorage.removeItem')) {
        console.log('\n4️⃣ Member App: planName and Clear Cache found');
    } else {
        console.error('\n❌ Member App logic missing');
    }

    console.log('\n✅ Verification Complete!');

} catch (error) {
    console.error('\n❌ Verification Error:', error.message);
    process.exit(1);
}
