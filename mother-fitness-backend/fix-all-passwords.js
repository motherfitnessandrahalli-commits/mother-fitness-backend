
const mongoose = require('mongoose');
const { Customer } = require('./src/models');
require('dotenv').config();

const fixAll = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to DB.');

        const customers = await Customer.find({});
        console.log(`Found ${customers.length} customers. Resetting passwords...`);

        for (const customer of customers) {
            customer.password = '0000';
            await customer.save();
            process.stdout.write('.');
        }

        console.log('\n✅ All passwords reset to "0000".');

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
};

fixAll();
