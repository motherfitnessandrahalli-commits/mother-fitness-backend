const express = require('express');
const {
    getCustomers,
    getCustomer,
    createCustomer,
    updateCustomer,
    deleteCustomer,
    getCustomerStats,
    syncBadges
} = require('../controllers/customerController');
const { protect, restrictTo } = require('../middleware/auth');
const { validate, customerSchemas } = require('../middleware/validation');

const router = express.Router();

// Protect all routes
router.use(protect);

// Stats route
router.get('/stats/overview', getCustomerStats);

// Sync Badges route (Admin only)
router.post('/sync-badges', restrictTo('admin'), syncBadges);

/**
 * @swagger
 * tags:
 *   name: Customers
 *   description: Customer management
 */

/**
 * @swagger
 * /api/customers:
 *   get:
 *     summary: Get all customers
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Items per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by name, email, or phone
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, expiring, expired]
 *         description: Filter by status
 *     responses:
 *       200:
 *         description: List of customers
 *   post:
 *     summary: Create a new customer
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - age
 *               - email
 *               - phone
 *               - plan
 *             properties:
 *               name:
 *                 type: string
 *               age:
 *                 type: integer
 *               email:
 *                 type: string
 *               phone:
 *                 type: string
 *               plan:
 *                 type: string
 *                 enum: [Monthly, Quarterly, Half-Yearly, Yearly]
 *     responses:
 *       201:
 *         description: Customer created
 */
router.route('/')
    .get(getCustomers)
    .post(restrictTo('admin', 'staff'), validate(customerSchemas.create), createCustomer);

/**
 * @swagger
 * /api/customers/{id}:
 *   get:
 *     summary: Get customer by ID
 *     tags: [Customers]
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
 *         description: Customer details
 *       404:
 *         description: Customer not found
 *   put:
 *     summary: Update customer
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Customer updated
 *   delete:
 *     summary: Delete customer
 *     tags: [Customers]
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
 *         description: Customer deleted
 */
router.route('/:id')
    .get(getCustomer)
    .put(restrictTo('admin', 'staff'), validate(customerSchemas.update), updateCustomer)
    .delete(restrictTo('admin'), deleteCustomer); // Only admin can delete

module.exports = router;
