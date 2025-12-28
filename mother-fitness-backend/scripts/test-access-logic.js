require('dotenv').config();
const mongoose = require('mongoose');
const { Customer, Attendance } = require('../src/models');

// MOCK DEPENDENCIES
// We need to mock these before requiring the service
const mockSocket = { emit: (event, data) => console.log(`[SOCKET EMIT] ${event}:`, data) };
const mockIO = { emit: (event, data) => console.log(`[SOCKET BROADCAST] ${event}:`, data) };

// Override the socket config to return our mock
const socketConfig = require('../src/config/socket');
socketConfig.getIO = () => mockIO;

// Mock ZKTecoService to avoid network calls
const ZKTecoService = require('../src/services/ZKTecoService');
ZKTecoService.unlockDevice = async (ip) => {
    console.log(`[MOCK DEVICE] 🔓 UNLOCK signal sent to ${ip}`);
    return true;
};

// Now load the service
const accessControl = require('../src/services/AccessControlService');

async function runTest() {
    console.log('--- STARTING ACCESS CONTROL SIMULATION ---\n');

    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mother_fitness');
        console.log('✅ Connected to DB');

        // 1. Create a Fake Customer
        const testMemberId = 'TEST_9999';
        await Customer.deleteOne({ memberId: testMemberId }); // Cleanup old

        const customer = await Customer.create({
            name: 'Test User',
            memberId: testMemberId,
            phone: '9999999999',
            membershipStatus: 'ACTIVE',
            isInside: false,
            // Required by schema
            membership: {
                planId: 'TEST_PLAN',
                planName: 'Monthly Gold',
                durationDays: 30,
                startDate: new Date(),
                endDate: new Date(new Date().setDate(new Date().getDate() + 30)),
                planPriceAtPurchase: 1000
            }
        });

        console.log(`\n👤 Created Test User: ${customer.name}`);

        // --- TEST CASE 1: 5 Days Remaining (Normal) ---
        console.log('\n--- TEST 1: 5 Days Remaining (Normal) ---');
        let future = new Date();
        future.setDate(future.getDate() + 5);
        customer.membership.endDate = future;
        customer.isInside = false;
        await customer.save();

        // Inject helper to mock virtual 'validity' if model uses it, 
        // OR ensures AccessControlService uses customer.validity (which might be a virtual).
        // If 'validity' was a virtual in Schema, it likely maps to membership.endDate.
        // Let's assume AccessControlService reads .validity.
        // I need to ensure the Virtual is populated or AccessControl reads the right field.
        // For this test, I'll modify the customer object in memory if needed, 
        // but saving to DB and re-fetching is safer if logic depends on DB.
        // Re-fetch to apply virtuals
        let fetchedCustomer = await Customer.findById(customer._id);
        // Force mock the property if virtuals aren't active in this context
        Object.defineProperty(fetchedCustomer, 'validity', { value: future, writable: true });

        await accessControl.handleEntry(fetchedCustomer, { deviceIp: '192.168.1.201', deviceRole: 'IN' });

        // Verify Attendance
        let attendance = await Attendance.findOne({ memberId: testMemberId }).sort({ createdAt: -1 });
        if (attendance) {
            console.log(`✅ Attendance Created: ID=${attendance.attendanceId}, Dir=${attendance.direction}, Member=${attendance.memberId}`);
        } else {
            console.log('❌ UNABLE TO FIND ATTENDANCE RECORD');
        }


        // --- TEST CASE 2: 3 Days Remaining (Warning) ---
        console.log('\n--- TEST 2: 3 Days Remaining (Warning) ---');

        // Reset check-in status from previous test
        fetchedCustomer = await Customer.findById(customer._id);
        fetchedCustomer.isInside = false;

        future = new Date();
        future.setDate(future.getDate() + 3);
        fetchedCustomer.membership.endDate = future;
        await fetchedCustomer.save();

        // Mock virtual validity on the fresh instance
        Object.defineProperty(fetchedCustomer, 'validity', { value: future, writable: true });

        await accessControl.handleEntry(fetchedCustomer, { deviceIp: '192.168.1.201', deviceRole: 'IN' });


        // --- TEST CASE 3: 1 Day Remaining (Urgent) ---
        console.log('\n--- TEST 3: 1 Day Remaining (Urgent) ---');

        fetchedCustomer = await Customer.findById(customer._id);
        fetchedCustomer.isInside = false;

        future = new Date();
        future.setDate(future.getDate() + 1);
        fetchedCustomer.membership.endDate = future;
        await fetchedCustomer.save();

        Object.defineProperty(fetchedCustomer, 'validity', { value: future, writable: true });

        await accessControl.handleEntry(fetchedCustomer, { deviceIp: '192.168.1.201', deviceRole: 'IN' });


        // --- TEST CASE 4: EXPIRED ---
        console.log('\n--- TEST 4: Expired (1 day ago) ---');

        fetchedCustomer = await Customer.findById(customer._id);
        fetchedCustomer.isInside = false;

        let past = new Date();
        past.setDate(past.getDate() - 1);
        fetchedCustomer.membership.endDate = past;
        await fetchedCustomer.save();

        Object.defineProperty(fetchedCustomer, 'validity', { value: past, writable: true });

        await accessControl.handleEntry(fetchedCustomer, { deviceIp: '192.168.1.201', deviceRole: 'IN' });

        // CLEANUP
        await Customer.deleteOne({ _id: customer._id });
        await Attendance.deleteMany({ memberId: testMemberId });
        console.log('\n✅ Test Complete. Cleanup Done.');

    } catch (error) {
        console.error('❌ Test Failed:', error);
    } finally {
        await mongoose.disconnect();
        process.exit();
    }
}

runTest();
