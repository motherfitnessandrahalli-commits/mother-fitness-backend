/**
 * SIMPLIFIED DEMO TEST DATA - 4 KEY SCENARIOS
 */

const mongoose = require('mongoose');
const { Customer, Attendance } = require('../src/models');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/motherfitness_db';

const testScenarios = [
    {
        name: "Raj Kumar",
        memberId: "DEMO001",
        age: 28,
        email: "raj@demo.com",
        phone: "9876543210",
        plan: "Monthly",
        validity: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // Active
        lastActivity: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000), // 45 days ago
        totalVisits: 3,
        password: "demo123",
        scenario: "CHURN_RISK",
        description: "Active plan but NO VISIT in 45 days → CHURN RISK"
    },
    {
        name: "Priya Sharma",
        memberId: "DEMO002",
        age: 24,
        email: "priya@demo.com",
        phone: "9876543211",
        plan: "Quarterly",
        validity: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Expired 7 days ago
        lastActivity: new Date(), // Visited today
        totalVisits: 25,
        balance: -3000,
        password: "demo123",
        scenario: "REVENUE_LEAKAGE",
        description: "Expired 7 days ago but STILL VISITING → REVENUE LOSS"
    },
    {
        name: "Amit Patel",
        memberId: "DEMO003",
        age: 32,
        email: "amit@demo.com",
        phone: "9876543212",
        plan: "Yearly",
        validity: new Date(Date.now() + 300 * 24 * 60 * 60 * 1000), // 10 months left
        lastActivity: new Date(), // Visits daily
        totalVisits: 180,
        password: "demo123",
        scenario: "HEALTHY",
        description: "Active member with daily visits → IDEAL CUSTOMER"
    },
    {
        name: "Neha Singh",
        memberId: "DEMO004",
        age: 26,
        email: "neha@demo.com",
        phone: "9876543213",
        plan: "Monthly",
        validity: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000), // 20 days left
        lastActivity: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000), // 20 days ago
        totalVisits: 8,
        password: "demo123",
        scenario: "WARNING",
        description: "Active but 20 days no visit → EARLY WARNING"
    }
];

async function generateDemoData() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('✅ Connected to MongoDB\n');

        // Clear existing demo data
        console.log('🗑️  Clearing old demo data...');
        await Customer.deleteMany({ memberId: { $regex: /^DEMO/ } });
        await Attendance.deleteMany({ customerName: { $in: testScenarios.map(s => s.name) } });
        console.log('✅ Cleared\n');

        console.log('📝 Creating 4 test members...\n');
        const created = [];

        for (const scenario of testScenarios) {
            const customer = await Customer.create({
                name: scenario.name,
                memberId: scenario.memberId,
                age: scenario.age,
                email: scenario.email,
                phone: scenario.phone,
                plan: scenario.plan,
                validity: scenario.validity,
                lastActivity: scenario.lastActivity,
                totalVisits: scenario.totalVisits,
                balance: scenario.balance || 0,
                isInside: false,
                password: scenario.password
            });

            created.push(customer);
            console.log(`  ${scenario.scenario === 'CHURN_RISK' ? '⚠️' : scenario.scenario === 'REVENUE_LEAKAGE' ? '💸' : scenario.scenario === 'HEALTHY' ? '✅' : '⏰'} ${scenario.name}`);
            console.log(`     ${scenario.description}\n`);
        }

        // Create attendance for specific scenarios
        console.log('📊 Generating attendance patterns...\n');

        // Priya - 5 visits while expired (REVENUE LEAKAGE)
        const priya = created.find(c => c.memberId === 'DEMO002');
        for (let i = 0; i < 5; i++) {
            const visitDate = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
            await Attendance.create({
                customerId: priya._id,
                customerName: priya.name,
                date: visitDate.toISOString().split('T')[0],
                time: '10:00 AM',
                timestamp: visitDate,
                membershipStatus: 'expired',
                type: 'IN'
            });
        }
        console.log('  💸 Priya: 5 visits while expired');

        // Amit - regular healthy visits (last 7 days)
        const amit = created.find(c => c.memberId === 'DEMO003');
        for (let i = 0; i < 7; i++) {
            const visitDate = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
            await Attendance.create({
                customerId: amit._id,
                customerName: amit.name,
                date: visitDate.toISOString().split('T')[0],
                time: '08:00 AM',
                timestamp: visitDate,
                membershipStatus: 'active',
                type: 'IN'
            });
        }
        console.log('  ✅ Amit: 7 consecutive daily visits');

        console.log('\n🎯 DEMO DATA READY!\n');
        console.log('Expected Intelligence Results:');
        console.log('  • Churn Risk: 2 members (Raj, Neha)');
        console.log('  • Revenue Leakage: 1 member (Priya)');
        console.log('  • Health Score: ~25% (1 of 4 active members visited)');
        console.log('\n👉 Open Intelligence Dashboard to verify!\n');

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

generateDemoData();
