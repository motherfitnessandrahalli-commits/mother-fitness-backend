const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const uri = process.env.MONGODB_URI || '';
const isCloud = uri.includes('mongodb.net');
const isLocal = uri.includes('localhost') || uri.includes('127.0.0.1');

console.log('__DB_TYPE_CHECK__');
console.log(isCloud ? 'CLOUD' : isLocal ? 'LOCAL' : 'UNKNOWN');
