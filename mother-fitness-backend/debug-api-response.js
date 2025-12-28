
const mongoose = require('mongoose');
const { getBusinessHealth } = require('./src/controllers/intelligenceController');
const fs = require('fs');
require('dotenv').config();

const run = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);

        const req = {};
        const res = {
            status: (code) => ({
                json: (data) => {
                    fs.writeFileSync('debug-output.json', JSON.stringify(data, null, 2));
                    console.log('Output written to debug-output.json');
                }
            })
        };

        await getBusinessHealth(req, res, (err) => { console.error('Next called with error:', err) });

    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
};

run();
