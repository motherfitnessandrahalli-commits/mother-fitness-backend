require('dotenv').config();
const mongoose = require('mongoose');

console.log('Testing MongoDB connection...');
console.log('MongoDB URI:', process.env.MONGODB_URI);

mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
    .then(() => {
        console.log('✅ MongoDB connected successfully!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ MongoDB connection failed:', error.message);
        console.error('Full error:', error);
        process.exit(1);
    });
