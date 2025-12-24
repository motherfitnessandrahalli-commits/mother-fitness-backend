// Quick script to check customer U011 status
const mongoose = require('mongoose');
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/motherfitness_db';

async function checkU011() {
    try {
        await mongoose.connect(MONGO_URI);

        const Customer = mongoose.model('Customer', new mongoose.Schema({}, { strict: false }));
        const Attendance = mongoose.model('Attendance', new mongoose.Schema({}, { strict: false }));

        // Find U011
        const customer = await Customer.findOne({ memberId: 'U011' });

        if (!customer) {
            console.log('❌ Customer U011 not found');
            process.exit(1);
        }

        console.log('\n👤 Customer U011 Status:');
        console.log('  Name:', customer.name);
        console.log('  isInside:', customer.isInside);
        console.log('  Validity:', customer.validity);
        console.log('  Status:', customer.status);

        // Get today's attendance
        const today = new Date().toISOString().split('T')[0];
        const todayAttendance = await Attendance.find({
            customerId: customer._id,
            date: today
        }).sort({ timestamp: 1 });

        console.log(`\n📅 Today's Attendance (${todayAttendance.length} records):`);
        todayAttendance.forEach((att, i) => {
            console.log(`  ${i + 1}. ${att.type} at ${att.time} - ${att.membershipStatus}`);
        });

        console.log('\n💡 Analysis:');
        if (customer.isInside) {
            console.log('  ⚠️  Member is marked as INSIDE');
            console.log('  ⚠️  Next IN scan will be DENIED (anti-passback)');
            console.log('  ✅  Next OUT scan will be ALLOWED');
        } else {
            console.log('  ✅  Member is marked as OUTSIDE');
            console.log('  ✅  Next IN scan should be ALLOWED');
            console.log('  ⚠️  Next OUT scan might be denied (not inside)');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

checkU011();
