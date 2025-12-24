// Quick debug script to check demo data and intelligence logic
const mongoose = require('mongoose');
const { Customer, Attendance } = require('../src/models');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/motherfitness_db';

async function debugIntelligence() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('\n🔍 DEBUGGING INTELLIGENCE DATA\n');

        // 1. Check demo members exist
        const demoMembers = await Customer.find({ memberId: /^DEMO/ });
        console.log(`✅ Found ${demoMembers.length} demo members:\n`);

        demoMembers.forEach(m => {
            const isExpired = new Date(m.validity) < new Date();
            console.log(`  ${m.name} (${m.memberId})`);
            console.log(`    Validity: ${m.validity.toISOString().split('T')[0]} ${isExpired ? '❌ EXPIRED' : '✅ ACTIVE'}`);
            console.log(`    Last Activity: ${m.lastActivity ? m.lastActivity.toISOString().split('T')[0] : 'Never'}`);
            console.log('');
        });

        // 2. Check attendance records
        const attendances = await Attendance.find({
            customerName: { $in: demoMembers.map(m => m.name) }
        }).sort({ createdAt: -1 }).limit(20);

        console.log(`📊 Found ${attendances.length} attendance records\n`);

        // 3. Check churn logic
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const tenDaysAgo = new Date();
        tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

        const activeMembers = await Customer.find({ validity: { $gte: today } });
        console.log(`Active members count: ${activeMembers.length}`);

        // Check which should be churn risk
        console.log('\n⚠️  CHURN RISK ANALYSIS:');
        for (const member of activeMembers) {
            if (!member.lastActivity || member.lastActivity < tenDaysAgo) {
                console.log(`  ${member.name}: Last activity ${member.lastActivity ? member.lastActivity.toISOString().split('T')[0] : 'Never'}`);
            }
        }

        // 4. Check revenue leakage (expired with recent visits)
        console.log('\n💸 REVENUE LEAKAGE ANALYSIS:');
        const expiredMembers = await Customer.find({ validity: { $lt: today } });

        for (const member of expiredMembers) {
            const recentVisits = await Attendance.countDocuments({
                customerId: member._id,
                createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
            });

            if (recentVisits > 0) {
                console.log(`  ${member.name}: ${recentVisits} visits in last 7 days (EXPIRED!)`);
            }
        }

        console.log('\n✅ Debug complete\n');

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

debugIntelligence();
