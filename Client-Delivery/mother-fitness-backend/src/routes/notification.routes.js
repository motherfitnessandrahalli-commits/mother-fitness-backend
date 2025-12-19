const express = require('express');
const { sendExpiryNotifications, sendCustomEmail } = require('../controllers/notificationController');
const { protect, restrictTo } = require('../middleware/auth');

const router = express.Router();

// Protect all routes
router.use(protect);

// Send expiry notifications (Staff/Admin)
router.post('/email/expired', restrictTo('admin', 'staff'), sendExpiryNotifications);

// Send custom email (Admin only)
router.post('/email/custom', restrictTo('admin'), sendCustomEmail);

module.exports = router;
