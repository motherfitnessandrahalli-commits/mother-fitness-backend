const mongoose = require('mongoose');
const { Customer, Payment, Plan } = require('../models');  // Import Plan model
const { AppError, asyncHandler, sendSuccess } = require('../utils/errorHandler');
const { createPaginationMeta } = require('../utils/helpers');
const PaymentService = require('../services/PaymentService');
const CloudSyncService = require('../services/CloudSyncService');

/**
 * @desc    Get all customers
 * @route   GET /api/customers
 */
const getCustomers = asyncHandler(async (req, res, next) => {
    const {
        page = 1,
        limit = 10,
        search,
        status, // 'ACTIVE', 'EXPIRED'
        plan, // Plan Name
        sortBy = 'createdAt',
        order = 'desc'
    } = req.query;

    const query = {};

    // Search
    if (search) {
        const searchRegex = new RegExp(search, 'i');
        query.$or = [
            { name: searchRegex },
            { phone: searchRegex },
            { memberId: searchRegex }
        ];
    }

    // Filters
    if (status) {
        query.membershipStatus = status.toUpperCase();
    }
    if (plan) {
        query['membership.planName'] = new RegExp(plan, 'i');
    }

    // Pagination
    const limitParsed = parseInt(limit);
    const skip = (parseInt(page) - 1) * limitParsed;

    const customers = await Customer.find(query)
        .sort({ [sortBy]: order === 'asc' ? 1 : -1 })
        .limit(limitParsed)
        .skip(skip);

    const total = await Customer.countDocuments(query);

    // simple stats
    const active = await Customer.countDocuments({ membershipStatus: 'ACTIVE' });

    sendSuccess(res, 200, {
        customers,
        stats: { active },
        pagination: createPaginationMeta(total, page, limitParsed),
    });
});

/**
 * @desc    Get single customer
 * @route   GET /api/customers/:id
 */
const getCustomer = asyncHandler(async (req, res, next) => {
    // Try finding by _id first, then memberId
    let customer;
    if (mongoose.Types.ObjectId.isValid(req.params.id)) {
        customer = await Customer.findById(req.params.id);
    }

    if (!customer) {
        customer = await Customer.findOne({ memberId: req.params.id });
    }

    if (!customer) {
        return next(new AppError('Customer not found', 404));
    }

    sendSuccess(res, 200, { customer });
});

/**
 * @desc    Create new customer (with Membership)
 * @route   POST /api/customers
 */
const createCustomer = asyncHandler(async (req, res, next) => {
    const {
        name, phone, email, gender,
        planId, planName, durationDays, price, startDate, // Membership details
        initialPayment // Optional: { amount, method }
    } = req.body;

    // Validate Core Identify
    if (!name || !phone) throw new AppError('Name and Phone are required', 400);

    // 1. Construct Membership
    const effectiveStartDate = startDate ? new Date(startDate) : new Date();
    const duration = durationDays ? parseInt(durationDays) : 30; // Default 30

    const effectiveEndDate = new Date(effectiveStartDate);
    effectiveEndDate.setDate(effectiveEndDate.getDate() + duration);

    const membership = {
        planId: planId || 'CUSTOM',
        planName: planName || 'Monthly',
        durationDays: duration,
        startDate: effectiveStartDate,
        endDate: effectiveEndDate,
        planPriceAtPurchase: price ? Number(price) : 0
    };

    // 2. Create Member
    const customer = await Customer.create({
        name,
        phone,
        email,
        gender,
        membership,
        membershipStatus: 'ACTIVE', // Default active on create
        paymentSummary: {
            totalPaid: 0,
            balance: membership.planPriceAtPurchase,
            paymentStatus: 'PENDING'
        }
    });

    // 3. Handle Initial Payment
    let paymentRec = null;
    if (initialPayment && initialPayment.amount > 0) {
        paymentRec = await Payment.create({
            memberId: customer.memberId,
            amount: initialPayment.amount,
            method: initialPayment.method || 'CASH',
            paymentDate: new Date(),
            receivedBy: req.user ? req.user.name : 'admin'
        });

        // Recalculate will update paymentSummary
        await PaymentService.recalculatePaymentSummary(customer.memberId);

        // Reload customer to get updated summary
        const updated = await Customer.findById(customer._id);
        Object.assign(customer, updated.toObject());
    }

    sendSuccess(res, 201, { customer, payment: paymentRec }, 'Member registered successfully');
});

/**
 * @desc    Update customer (Renew or Edit Profile)
 * @route   PUT /api/customers/:id
 */
const updateCustomer = asyncHandler(async (req, res, next) => {
    const {
        name, phone, email, // Profile
        renewPlan // Optional Object: { planId, price, duration, startDate }
    } = req.body;

    let customer = await Customer.findById(req.params.id);
    if (!customer) return next(new AppError('Customer not found', 404));

    // Update Profile
    if (name) customer.name = name;
    if (phone) customer.phone = phone;
    if (email) customer.email = email;

    // Handle Renewal (New Membership Cycle)
    if (renewPlan) {
        const startDate = renewPlan.startDate ? new Date(renewPlan.startDate) : new Date();
        const duration = renewPlan.duration ? parseInt(renewPlan.duration) : 30;
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + duration);

        customer.membership = {
            planId: renewPlan.planId || 'RENEWAL',
            planName: renewPlan.planName || 'Renewal',
            durationDays: duration,
            startDate: startDate,
            endDate: endDate,
            planPriceAtPurchase: Number(renewPlan.price)
        };

        // Reset Payment Summary for new cycle
        customer.paymentSummary = {
            totalPaid: 0,
            balance: customer.membership.planPriceAtPurchase,
            paymentStatus: 'PENDING'
        };
        customer.membershipStatus = 'ACTIVE';
    }

    await customer.save(); // Triggers Sync

    sendSuccess(res, 200, { customer }, 'Customer updated');
});

/**
 * @desc    Delete customer
 * @route   DELETE /api/customers/:id
 */
const deleteCustomer = asyncHandler(async (req, res, next) => {
    const customer = await Customer.findById(req.params.id);
    if (!customer) return next(new AppError('Customer not found', 404));

    await customer.deleteOne();

    sendSuccess(res, 200, null, 'Customer deleted');
});

/**
 * @desc    Get customer stats
 * @route   GET /api/customers/stats/overview
 */
const getCustomerStats = asyncHandler(async (req, res, next) => {
    const total = await Customer.countDocuments();
    const active = await Customer.countDocuments({ membershipStatus: 'ACTIVE' });
    const expired = await Customer.countDocuments({ membershipStatus: 'EXPIRED' });

    // Expiring in 7 days
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const expiring = await Customer.countDocuments({
        membershipStatus: 'ACTIVE',
        'membership.endDate': { $lte: nextWeek }
    });

    sendSuccess(res, 200, {
        total,
        active,
        expiring,
        expired
    });
});

/**
 * @desc    Sync badges (Legacy Stub)
 * @route   POST /api/customers/sync-badges
 */
const syncBadges = asyncHandler(async (req, res, next) => {
    // Legacy functionality. 
    // If needed, we can implement badge logic here based on 'totalVisits' or similar.
    sendSuccess(res, 200, { synced: 0 }, 'Badges synced');
});

module.exports = {
    getCustomers,
    getCustomer,
    createCustomer,
    updateCustomer,
    deleteCustomer,
    getCustomerStats,
    syncBadges
};
