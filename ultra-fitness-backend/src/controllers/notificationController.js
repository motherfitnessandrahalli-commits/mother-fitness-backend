const { Customer } = require('../models');
const { sendEmail, getExpiryTemplate } = require('../services/emailService');
const { asyncHandler, sendSuccess } = require('../utils/errorHandler');
const logger = require('../config/logger');

/**
 * @desc    Send expiry notifications to all expiring customers
 * @route   POST /api/notifications/email/expired
 * @access  Private (Admin/Staff)
 */
const sendExpiryNotifications = asyncHandler(async (req, res, next) => {
    // Find expiring customers (validity between last 7 days and next 7 days)
    // This allows re-sending or notifying recently expired members too
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);

    const expiringCustomers = await Customer.find({
        validity: { $gte: lastWeek, $lte: nextWeek }
    });

    if (expiringCustomers.length === 0) {
        return sendSuccess(res, 200, { sent: 0, failed: 0 }, 'No expiring or recently expired customers found');
    }

    let sentCount = 0;
    let failedCount = 0;
    const errors = [];

    // Send emails in parallel (limit concurrency in production)
    const emailPromises = expiringCustomers.map(async (customer) => {
        try {
            const { subject, text, html } = getExpiryTemplate(
                customer.name,
                customer.plan,
                customer.validity
            );

            await sendEmail({
                to: customer.email,
                subject,
                text,
                html,
            });

            sentCount++;
        } catch (error) {
            failedCount++;
            errors.push({ email: customer.email, error: error.message });
            logger.error(`Failed to send email to ${customer.email}: ${error.message}`);
        }
    });

    await Promise.all(emailPromises);

    sendSuccess(res, 200, {
        total: expiringCustomers.length,
        sent: sentCount,
        failed: failedCount,
        errors: errors.length > 0 ? errors : undefined
    }, `Processed ${expiringCustomers.length} notifications (Expired/Expiring)`);
});

/**
 * @desc    Send custom email to a customer
 * @route   POST /api/notifications/email/custom
 * @access  Private (Admin only)
 */
const sendCustomEmail = asyncHandler(async (req, res, next) => {
    const { customerId, subject, message } = req.body;

    const customer = await Customer.findById(customerId);
    if (!customer) {
        return next(new AppError('Customer not found', 404));
    }

    await sendEmail({
        to: customer.email,
        subject,
        text: message,
        html: `<p>${message.replace(/\n/g, '<br>')}</p>`
    });

    sendSuccess(res, 200, null, 'Email sent successfully');
});

module.exports = {
    sendExpiryNotifications,
    sendCustomEmail
};
