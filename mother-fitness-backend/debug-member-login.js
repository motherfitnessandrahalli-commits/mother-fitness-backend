
const mongoose = require('mongoose');
const { Customer } = require('./src/models');
require('dotenv').config();

const run = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected.');

        const memberId = 'U005';
        const passwordStart = '0000';

        // 1. Find Customer
        const customer = await Customer.findOne({ memberId }).select('+password');

        if (!customer) {
            console.log(`Customer ${memberId} NOT FOUND.`);
            return;
        }

        console.log(`Found Customer: ${customer.name} (${customer.memberId})`);
        console.log(`Stored Password Hash: ${customer.password}`);

        // 2. Test Compare
        if (customer.password) {
            const isMatch = await customer.comparePassword(passwordStart);
            console.log(`Compare '0000': ${isMatch}`);
        } else {
            console.log('No password set.');
        }

        // 3. Reset Password to '0000' explicitly to fix it
        console.log('Resetting password to "0000"...');
        customer.password = '0000';
        await customer.save(); // Should trigger hash hook
        console.log('Saved.');

        // 4. Verify again
        const customerRefetched = await Customer.findOne({ memberId }).select('+password');
        const isMatchNew = await customerRefetched.comparePassword('0000');
        console.log(`Compare '0000' after reset: ${isMatchNew}`);

    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
};

run();
