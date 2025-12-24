// Script to show the MONGODB_URI being used by the app
require('dotenv').config();
console.log('--- DB CONNECTION INFO ---');
console.log('MONGODB_URI:', process.env.MONGODB_URI);
console.log('--------------------------');
process.exit(0);
