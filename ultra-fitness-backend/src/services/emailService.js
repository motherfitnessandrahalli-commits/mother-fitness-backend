const { transporter } = require('../config/email');
const logger = require('../config/logger');

/**
 * Send email
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.text - Plain text body
 * @param {string} options.html - HTML body
 */
const sendEmail = async (options) => {
    const message = {
        from: process.env.EMAIL_FROM || 'Ultra Fitness <noreply@ultrafitness.com>',
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
    };

    try {
        const info = await transporter.sendMail(message);
        logger.info(`Email sent: ${info.messageId}`);
        return info;
    } catch (error) {
        logger.error(`Error sending email: ${error.message}`);
        throw error;
    }
};

/**
 * Get Expiry Notification Template
 * @param {string} name - Customer name
 * @param {string} plan - Plan name
 * @param {Date} validity - Expiry date
 * @returns {Object} Subject, text, and html
 */
const getExpiryTemplate = (name, plan, validity) => {
    const dateStr = new Date(validity).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });

    const subject = `⚠️ Membership Expiring Soon - Ultra Fitness`;

    const text = `Hello ${name},\n\nYour ${plan} membership at Ultra Fitness is expiring on ${dateStr}.\n\nPlease renew your membership to continue enjoying our facilities.\n\nRegards,\nUltra Fitness Team`;

    const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
        <h2 style="color: #e74c3c;">Membership Expiring Soon</h2>
        <p>Hello <strong>${name}</strong>,</p>
        <p>This is a friendly reminder that your <strong>${plan}</strong> membership at Ultra Fitness is expiring on:</p>
        <h3 style="background-color: #f9f9f9; padding: 10px; text-align: center; border-radius: 5px;">${dateStr}</h3>
        <p>Please renew your membership to continue enjoying our facilities without interruption.</p>
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #888;">
            <p>Regards,<br>Ultra Fitness Team</p>
        </div>
    </div>
    `;

    return { subject, text, html };
};

/**
 * Get Welcome Template
 * @param {string} name - Customer name
 * @param {string} plan - Plan name
 * @returns {Object} Subject, text, and html
 */
const getWelcomeTemplate = (name, plan) => {
    const subject = `🎉 Welcome to Ultra Fitness!`;

    const text = `Hello ${name},\n\nWelcome to Ultra Fitness! We are excited to have you on board with our ${plan} plan.\n\nGet ready to achieve your fitness goals!\n\nRegards,\nUltra Fitness Team`;

    const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
        <h2 style="color: #2ecc71;">Welcome to Ultra Fitness!</h2>
        <p>Hello <strong>${name}</strong>,</p>
        <p>We are excited to have you on board with our <strong>${plan}</strong> plan.</p>
        <p>Get ready to crush your fitness goals! Our trainers and facilities are here to support you every step of the way.</p>
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #888;">
            <p>Regards,<br>Ultra Fitness Team</p>
        </div>
    </div>
    `;

    return { subject, text, html };
};

module.exports = {
    sendEmail,
    getExpiryTemplate,
    getWelcomeTemplate,
};
