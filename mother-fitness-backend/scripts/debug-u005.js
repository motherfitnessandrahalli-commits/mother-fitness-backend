const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function debugUser() {
    try {
        console.log('Connecting to database...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected.');

        const Customer = require('../src/models/Customer');

        const memberId = 'U005';
        const passwordToTest = 'tqbwjwr4';

        console.log(`Searching for member: ${memberId}`);
        const customer = await Customer.findOne({ memberId: memberId }).select('+password');

        if (!customer) {
            console.error(`❌ Customer ${memberId} NOT FOUND in database.`);
            return;
        }

        console.log(`✅ Customer found: ${customer.name}`);
        console.log(`Email: ${customer.email}`);
        console.log(`Status: ${customer.status}`);
        console.log(`Has password: ${!!customer.password}`);

        if (customer.password) {
            console.log('Testing password match...');
            const isMatch = await bcrypt.compare(passwordToTest, customer.password);
            if (isMatch) {
                console.log('✅ Password matches stored hash.');
            } else {
                console.log('❌ Password DOES NOT match stored hash.');

                // Extra check: maybe it's saved as plaintext?
                if (customer.password === passwordToTest) {
                    console.log('⚠️ Password is saved as PLAINTEXT instead of hash! This will cause issues with comparePassword.');
                }
            }
        }

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

debugUser();
