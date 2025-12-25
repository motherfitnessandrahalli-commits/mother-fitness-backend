const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function debugUser() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const Customer = require('../src/models/Customer');

        const memberId = 'U005';
        const passwordToTest = 'tqbwjwr4';

        const customer = await Customer.findOne({ memberId: memberId }).select('+password');

        if (!customer) {
            console.log('RESULT:USER_NOT_FOUND');
            process.exit(0);
        }

        if (!customer.password) {
            console.log('RESULT:NO_PASSWORD_SET');
            process.exit(0);
        }

        const isMatch = await bcrypt.compare(passwordToTest, customer.password);
        if (isMatch) {
            console.log('RESULT:PASSWORD_MATCH');
        } else {
            if (customer.password === passwordToTest) {
                console.log('RESULT:PLAINTEXT_PASSWORD_FOUND');
            } else {
                console.log('RESULT:PASSWORD_MISMATCH');
            }
        }

        process.exit(0);
    } catch (error) {
        console.log('RESULT:ERROR:' + error.message);
        process.exit(1);
    }
}

debugUser();
