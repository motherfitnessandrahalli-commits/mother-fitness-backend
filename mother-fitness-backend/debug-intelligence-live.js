
const mongoose = require('mongoose');
const { Customer, Attendance } = require('./src/models');
const { getBusinessHealth } = require('./src/controllers/intelligenceController');
require('dotenv').config();

const run = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected.');

        // 1. Check U001
        const u001 = await Customer.findOne({ memberId: 'U001' });
        if (u001) {
            console.log('U001 Validity:', u001.validity);
            console.log('U001 Status:', u001.membershipStatus);

            const count = await Attendance.countDocuments({ customerId: u001._id });
            console.log('U001 Attendance Count:', count);
        } else {
            console.log('U001 NOT FOUND!');
        }

        // 2. Run Intelligence Logic
        const req = {};
        const res = {
            status: (code) => res, // chainable
            json: (data) => {
                console.log('--- INTELLIGENCE OUTPUT ---');
                console.log(JSON.stringify(data, null, 2));
                console.log('---------------------------');
            }
        };

        console.log('Calling getBusinessHealth...');
        await getBusinessHealth(req, res, (err) => console.error('Next Error:', err));

    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
};

run();
