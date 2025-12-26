const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

async function checkCloud() {
    if (!process.env.CLOUD_MONGODB_URI) {
        console.log('No CLOUD_MONGODB_URI found');
        return;
    }

    try {
        console.log('Connecting to CLOUD DB...');
        const cloudConn = await mongoose.createConnection(process.env.CLOUD_MONGODB_URI).asPromise();
        console.log('Connected to CLOUD DB');

        const Customer = cloudConn.model('Customer', new mongoose.Schema({}, { strict: false }));
        const Payment = cloudConn.model('Payment', new mongoose.Schema({}, { strict: false }));

        const customer = await Customer.findOne({ memberId: 'U009' });
        if (!customer) {
            console.log('Customer U009 not found in CLOUD');
            return;
        }
        console.log(`Found Customer in CLOUD: ${customer.name} (ID: ${customer._id})`);

        const payments = await Payment.find({ customerId: customer._id });
        console.log(`Found ${payments.length} payments in CLOUD for this customer ID`);

        const allPaymentsForName = await Payment.find({ customerName: 'gandi' });
        console.log(`Found ${allPaymentsForName.length} payments in CLOUD for name "gandi"`);

        allPaymentsForName.forEach(p => {
            console.log(`- Payment in CLOUD ID: ${p._id}, Linked customerId: ${p.customerId}`);
        });

    } catch (err) {
        console.error('Cloud Check Error:', err);
    } finally {
        // Since we used createConnection, we need to close it specifically or it might hang
        process.exit(0);
    }
}

checkCloud();
