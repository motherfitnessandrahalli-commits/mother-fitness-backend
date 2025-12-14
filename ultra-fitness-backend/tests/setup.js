const mongoose = require('mongoose');

beforeAll(async () => {
    // Connect to a test database
    const url = process.env.MONGODB_URI_TEST || 'mongodb://localhost:27017/ultra-fitness-test';

    try {
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(url);
        }
    } catch (error) {
        console.error('Test DB Connection Error:', error);
        process.exit(1);
    }
});

afterAll(async () => {
    // Drop database and close connection
    if (mongoose.connection.readyState !== 0) {
        try {
            await mongoose.connection.dropDatabase();
            await mongoose.connection.close();
        } catch (error) {
            console.error('Test DB Cleanup Error:', error);
        }
    }
});
