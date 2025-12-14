const express = require('express');
const {
    getPayments,
    getCustomerPayments,
    createPayment,
    updatePayment,
    deletePayment,
    getPaymentStats,
} = require('../controllers/paymentController');
const { protect, restrictTo } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(protect);

/**
 * @swagger
 * /api/payments:
 *   get:
 *     summary: Get all payments
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: customerId
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [completed, pending, failed]
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of payments
 *   post:
 *     summary: Create payment record
 *     tags: [Payments]
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
 *               - amount
 *               - paymentMethod
 *               - planType
 *             properties:
 *               customerId:
 *                 type: string
 *               amount:
 *                 type: number
 *               paymentDate:
 *                 type: string
 *                 format: date
 *               paymentMethod:
 *                 type: string
 *                 enum: [Cash, Card, UPI, Bank Transfer, Cheque, Other]
 *               receiptNumber:
 *                 type: string
 *               planType:
 *                 type: string
 *                 enum: [Monthly, Quarterly, Half-Yearly, Yearly]
 *               status:
 *                 type: string
 *                 enum: [completed, pending, failed]
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Payment created
 */
router.route('/')
    .get(getPayments)
    .post(createPayment);

/**
 * @swagger
 * /api/payments/stats/overview:
 *   get:
 *     summary: Get payment statistics
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Payment statistics
 */
router.get('/stats/overview', getPaymentStats);

/**
 * @swagger
 * /api/payments/customer/{customerId}:
 *   get:
 *     summary: Get customer payments
 *     tags: [Payments]
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
 *         description: Customer payments
 */
router.get('/customer/:customerId', getCustomerPayments);

/**
 * @swagger
 * /api/payments/{id}:
 *   put:
 *     summary: Update payment
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Payment updated
 *   delete:
 *     summary: Delete payment
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Payment deleted
 */
router.route('/:id')
    .put(updatePayment)
    .delete(restrictTo('admin'), deletePayment); // Only admin can delete

module.exports = router;
