const express = require('express');
const {
    markAttendance,
    getAttendance,
    getAttendanceStats,
    getCustomerAttendance,
    getCurrentGymCount
} = require('../controllers/attendanceController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Protect all routes
router.use(protect);

/**
 * @swagger
 * tags:
 *   name: Attendance
 *   description: Attendance tracking
 */

/**
 * @swagger
 * /api/attendance/mark:
 *   post:
 *     summary: Mark attendance
 *     tags: [Attendance]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - customerId
 *             properties:
 *               customerId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Attendance marked
 *       400:
 *         description: Already marked for today
 */
router.post('/mark', markAttendance);

/**
 * @swagger
 * /api/attendance/current-count:
 *   get:
 *     summary: Get current gym count
 *     tags: [Attendance]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Number of members currently in gym
 */
router.get('/current-count', getCurrentGymCount);

/**
 * @swagger
 * /api/attendance:
 *   get:
 *     summary: Get attendance records
 *     tags: [Attendance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter by date (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: List of attendance records
 */
router.get('/', getAttendance);

/**
 * @swagger
 * /api/attendance/stats:
 *   get:
 *     summary: Get attendance statistics
 *     tags: [Attendance]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Daily and weekly stats
 */
router.get('/stats', getAttendanceStats);

/**
 * @swagger
 * /api/attendance/customer/{customerId}:
 *   get:
 *     summary: Get customer attendance history
 *     tags: [Attendance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: customerId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Customer attendance history
 */
router.get('/customer/:customerId', getCustomerAttendance);

module.exports = router;
