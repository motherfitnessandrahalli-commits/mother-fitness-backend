const nodemailer = require('nodemailer');
const logger = require('./logger');

// Create transporter
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // Use STARTTLS
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
    },
    // Prevent hanging & Force IPv4 (Fixes Render/Gmail timeouts)
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000,
    dnsTimeout: 5000,
    family: 4, // Force IPv4
    logger: true,
    debug: true,
});

// Verify connection configuration
const verifyEmailConnection = async () => {
    try {
        await transporter.verify();
        logger.info('✅ Email service ready');
        return true;
    } catch (error) {
        logger.error(`❌ Email service error: ${error.message}`);
        return false;
    }
};

module.exports = {
    transporter,
    verifyEmailConnection,
};
