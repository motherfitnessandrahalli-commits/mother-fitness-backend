/**
 * DEMO TEST DATA GENERATOR FOR GYM INTELLIGENCE
 * 
 * This script creates controlled test scenarios for demonstrating:
 * - Churn Risk Detection
 * - Revenue Leakage Identification  
 * - Business Health Scoring
 * - Member Journey Timeline
 * 
 * Run this BEFORE your demo to ensure predictable results
 */

const mongoose = require('mongoose');
const { Customer, Attendance, Payment, TimelineEvent } = require('../src/models');

// Connect to MongoDB
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/motherfitness_db';

const testScenarios = [
    {
        name: "Raj Kumar",
        memberId: "RAJ001",
        age: 28,
        email: "raj@demo.com",
        phone: "9876543210",
        plan: "Monthly",
        validity: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // Active - expires in 15 days
        lastActivity: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000), // 45 days ago
        totalVisits: 3,
        balance: 0,
        isInside: false,
        password: "demo123",
        scenario: "CHURN_RISK",
        description: "Active member but no visit in 45 days - HIGH CHURN RISK"
    },
    {
        name: "Priya Sharma",
        memberId: "PRIYA002",
        age: 24,
        email: "priya@demo.com",
        phone: "9876543211",
        plan: "Quarterly",
        validity: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Expired 7 days ago
        lastActivity: new Date(), // Visited today
        totalVisits: 25,
        balance: -3000, // Owes money
        isInside: false,
        password: "demo123",
        scenario: "REVENUE_LEAKAGE",
        description: "Expired membership but still visiting - REVENUE LOSS"
    },
    {
        name: "Amit Patel",
        memberId: "AMIT003",
        age: 32,
        email: "amit@demo.com",
        phone: "9876543212",
        plan: "Yearly",
        validity: new Date(Date.now() + 300 * 24 * 60 * 60 * 1000), // 300 days left
        lastActivity: new Date(), // Visited today
        totalVisits: 180,
        balance: 0,
        isInside: false,
        password: "demo123",
        scenario: "HEALTHY",
        description: "Active member with regular visits - IDEAL CUSTOMER"
    },
    {
        name: "Neha Singh",
        memberId: "NEHA004",
        age: 26,
        email: "neha@demo.com",
        phone: "9876543213",
        plan: "Monthly",
        validity: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000), // 20 days left
        lastActivity: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000), // 20 days ago
        totalVisits: 8,
        balance: 0,
        isInside: false,
        password: "demo123",
        scenario: "WARNING",
        description: "Active but declining attendance - WARNING SIGN"
    },
    {
        name: "Sunil Verma",
        memberId: "SUNIL005",
        age: 45,
        email: "sunil@demo.com",
        phone: "9876543214",
        plan: "Monthly",
        validity: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Expired 30 days ago
        lastActivity: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000), // No recent activity
        totalVisits: 5,
        balance: 0,
        isInside: false,
        password: "demo123",
        scenario: "EXPIRED_INACTIVE",
        description: "Expired and not visiting - Normal churn"
    },
    {
        name: "Kiran Reddy",
        memberId: "KIRAN006",
        age: 29,
        email: "kiran@demo.com",
        phone: "9876543215",
        plan: "Half-Yearly",
        validity: new Date(Date.now() + 150 * 24 * 60 * 60 * 1000),
        lastActivity: new Date(), // Visits daily
        totalVisits: 150,
        balance: 0,
        isInside: false,
        password: "demo123",
        scenario: "SUPER_HEALTHY",
        description: "Daily visitor - High engagement"
    },
    {
        name: "Divya Nair",
        memberId: "DIVYA007",
        age: 23,
        email: "divya@demo.com",
        phone: "9876543216",
        plan: "Monthly",
        validity: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // Expired 3 days ago
        lastActivity: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // Visited yesterday
        totalVisits: 15,
        balance: -1500,
        isInside: false,
        password: "demo123",
        scenario: "REVENUE_LEAKAGE",
        description: "Recently expired but still active - Quick revenue recovery opportunity"
    },
    {
        name: "Arjun Khanna",
        memberId: "ARJUN008",
        age: 35,
        email: "arjun@demo.com",
        phone: "9876543217",
        plan: "Quarterly",
        validity: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        lastActivity: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), // 15 days ago
        totalVisits: 20,
        balance: 0,
        isInside: false,
        password: "demo123",
        scenario: "CHURN_RISK",
        description: "Active member but missed 2 weeks - Early churn warning"
    }
];

async function generateTestData() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('✅ Connected to MongoDB\n');

        // Clear existing test data
        console.log('🗑️  Clearing existing test members...');
        await Customer.deleteMany({ memberId: { $in: testScenarios.map(s => s.memberId) } });
        await Attendance.deleteMany({ customerName: { $in: testScenarios.map(s => s.name) } });
        await TimelineEvent.deleteMany({ customerId: { $in: testScenarios.map(s => s.memberId) } });

        console.log('✅ Cleared old test data\n');

        // Create test members
        console.log('📝 Creating test members...\n');
        const createdMembers = [];

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
                totalVisits: scenario.totalVists,
                balance: scenario.balance,
                isInside: scenario.isInside,
                password: scenario.password
            });

            createdMembers.push(customer);

            console.log(`  ✓ ${scenario.name} (${scenario.memberId})`);
            console.log(`    → Scenario: ${scenario.scenario}`);
            console.log(`    → ${scenario.description}`);
            console.log('');
        }

        // Create attendance records for specific scenarios
        console.log('📊 Creating attendance history...\n');

        // Priya - multiple recent visits despite expired membership (REVENUE LEAKAGE)
        const priya = createdMembers.find(c => c.memberId === 'PRIYA002');
        for (let i = 0; i < 5; i++) {
            const visitDate = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
            await Attendance.create({
                customerId: priya._id,
                customerName: priya.name,
                date: visitDate.toISOString().split('T')[0],
                time: '10:00 AM',
                timestamp: visitDate,
                membershipStatus: 'expired',
                type: 'IN',
                deviceId: 'demo-device'
            });
        }
        console.log('  ✓ Created leakage scenario for Priya (5 visits while expired)');

        // Amit & Kiran - regular healthy visits
        const amit = createdMembers.find(c => c.memberId === 'AMIT003');
        const kiran = createdMembers.find(c => c.memberId === 'KIRAN006');

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

            await Attendance.create({
                customerId: kiran._id,
                customerName: kiran.name,
                date: visitDate.toISOString().split('T')[0],
                time: '06:00 PM',
                timestamp: visitDate,
                membershipStatus: 'active',
                type: 'IN'
            });
        }
        console.log('  ✓ Created healthy visit patterns for Amit & Kiran');

        // Divya - recent visit while expired (REVENUE LEAKAGE)
        const divya = createdMembers.find(c => c.memberId === 'DIVYA007');
        await Attendance.create({
            customerId: divya._id,
            customerName: divya.name,
            date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            time: '07:00 PM',
            timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
            membershipStatus: 'expired',
            type: 'IN'
        });
        console.log('  ✓ Created leakage scenario for Divya (visited yesterday while expired)');

        console.log('\n✅ TEST DATA GENERATION COMPLETE!\n');
        console.log('📊 Summary:');
        console.log(`  • Total Members Created: ${createdMembers.length}`);
        console.log(`  • Churn Risk Cases: ${testScenarios.filter(s => s.scenario === 'CHURN_RISK').length}`);
        console.log(`  • Revenue Leakage Cases: ${testScenarios.filter(s => s.scenario === 'REVENUE_LEAKAGE').length}`);
        console.log(`  • Healthy Members: ${testScenarios.filter(s => s.scenario.includes('HEALTHY')).length}`);
        console.log('\n🎯 Your demo is ready! Visit the Intelligence Dashboard to see the results.');

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n👋 Disconnected from MongoDB');
    }
}

// Run if executed directly
if (require.main === module) {
    generateTestData();
}

module.exports = { generateTestData, testScenarios };
