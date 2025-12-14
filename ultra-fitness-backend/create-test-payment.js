const mongoose = require('mongoose');
const dotenv = require('dotenv');
const { Payment, Customer } = require('./src/models');

// Load env vars
dotenv.config();

const createTestPayment = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Find test member
        const member = await Customer.findOne({ memberId: 'U001' });
        if (!member) {
            console.error('❌ Test member U001 not found');
            process.exit(1);
        }

        // Create dummy payments
        await Payment.create([
            {
                customerId: member._id,
                customerName: member.name,
                amount: 1500,
                paymentDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
                paymentMethod: 'UPI',
                receiptNumber: 'REC-001',
                planType: 'Monthly',
                status: 'completed',
                notes: 'First month payment'
            },
            {
                customerId: member._id,
                customerName: member.name,
                amount: 1500,
                paymentDate: new Date(), // Today
                paymentMethod: 'Cash',
                receiptNumber: 'REC-002',
                planType: 'Monthly',
                status: 'completed',
                notes: 'Renewal payment'
            }
        ]);

        console.log('✅ Created 2 test payments for U001');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
};

createTestPayment();
