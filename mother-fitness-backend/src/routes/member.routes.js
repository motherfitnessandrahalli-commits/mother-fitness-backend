const express = require('express');
const {
    memberLogin,
    getMemberProfile,
    updateMemberProfile,
    changePassword,
    getMemberAttendance,
    getMemberPayments,
    subscribePushNotification,
    getBadgeStatus,
    getMonthlyProgress,
    downloadPaymentReceipt,
} = require('../controllers/memberController');
const { protect } = require('../middleware/auth');
const noCache = require('../middleware/cacheControl');

const router = express.Router();

/**
 * @swagger
 * /api/member/login:
 *   post:
 *     summary: Member login
 *     tags: [Member]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - memberId
 *               - password
 *             properties:
 *               memberId:
 *                 type: string
 *                 example: U001
 *               password:
 *                 type: string
 *                 example: password123
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 */
router.post('/login', memberLogin);

// Protected routes (require member authentication)

/**
 * @swagger
 * /api/member/me:
 *   get:
 *     summary: Get member profile
 *     tags: [Member]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Member profile
 *       401:
 *         description: Not authenticated
 */
router.get('/me', protect, getMemberProfile);

/**
 * @swagger
 * /api/member/profile:
 *   put:
 *     summary: Update member profile
 *     tags: [Member]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               phone:
 *                 type: string
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile updated
 */
router.put('/profile', protect, updateMemberProfile);

/**
 * @swagger
 * /api/member/change-password:
 *   put:
 *     summary: Change password
 *     tags: [Member]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password changed
 */
router.put('/change-password', protect, changePassword);

/**
 * @swagger
 * /api/member/attendance:
 *   get:
 *     summary: Get member attendance history
 *     tags: [Member]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Number of records
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number
 *     responses:
 *       200:
 *         description: Attendance records
 */
router.get('/attendance', protect, getMemberAttendance);

/**
 * @swagger
 * /api/member/payments:
 *   get:
 *     summary: Get member payment history
 *     tags: [Member]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Number of records
 *       - in: query
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number
 *     responses:
 *       200:
 *         description: Payment records
 */
// ✅ No caching for payments
router.get('/payments', noCache, protect, getMemberPayments);

/**
 * @swagger
 * /api/member/payments/:paymentId/receipt:
 *   get:
 *     summary: Download payment receipt PDF
 *     tags: [Member]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: PDF receipt
 */
router.get('/payments/:paymentId/receipt', protect, downloadPaymentReceipt);

/**
 * @swagger
 * /api/member/subscribe-push:
 *   post:
 *     summary: Subscribe to push notifications
 *     tags: [Member]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - subscription
 *             properties:
 *               subscription:
 *                 type: object
 *     responses:
 *       200:
 *         description: Subscription successful
 */
router.post('/subscribe-push', protect, subscribePushNotification);

/**
 * @swagger
 * /api/member/badges:
 *   get:
 *     summary: Get member badge status
 *     tags: [Member]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Badge status
 */
router.get('/badges', protect, getBadgeStatus);

/**
 * @swagger
 * /api/member/monthly-progress:
 *   get:
 *     summary: Get monthly progress analytics
 *     tags: [Member]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Monthly stats
 */
router.get('/monthly-progress', protect, getMonthlyProgress);

module.exports = router;
