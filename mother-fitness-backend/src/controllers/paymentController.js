const { Payment, Customer } = require('../models');
const { AppError, asyncHandler, sendSuccess } = require('../utils/errorHandler');
const PaymentService = require('../services/PaymentService');
const CloudSyncService = require('../services/CloudSyncService');

/**
 * @desc    Get all payments with filtering
 * @route   GET /api/payments
 */
const getPayments = asyncHandler(async (req, res) => {
    const { customerId, page = 1, limit = 20 } = req.query;

    const query = {};

    // Auto-detect if customerId is passed
    if (customerId) {
        // Check if it's an ObjectId (legacy/url param) or MemberId (U001)
        const isObjectId = /^[0-9a-fA-F]{24}$/.test(customerId);
        if (isObjectId) {
            const customer = await Customer.findById(customerId);
            if (customer) query.memberId = customer.memberId;
        } else {
            query.memberId = customerId;
        }
    }

    const payments = await Payment.find(query)
        .sort({ paymentDate: -1 })
        .limit(parseInt(limit))
        .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Payment.countDocuments(query);

    sendSuccess(res, 200, {
        payments,
        pagination: {
            total,
            page: parseInt(page),
            pages: Math.ceil(total / limit)
        }
    });
});

/**
 * @desc    Get customer payments (Route Wrapper)
 * @route   GET /api/payments/customer/:customerId
 */
const getCustomerPayments = asyncHandler(async (req, res) => {
    // Reuse existing logic, just map params to query
    req.query.customerId = req.params.customerId;
    return getPayments(req, res);
});

/**
 * @desc    Create new payment (Immutable Ledger Entry)
 * @route   POST /api/payments
 */
const createPayment = asyncHandler(async (req, res) => {
    const {
        memberId, // Expecting HUMAN ID (U010)
        amount,
        method,
        transactionRef,
        notes,
        paymentDate
    } = req.body;

    if (!memberId || amount === undefined) {
        throw new AppError('Member ID and Amount are required', 400);
    }

    // 1. Verify Member Exists
    // We search by memberId string
    let member = await Customer.findOne({ memberId });
    if (!member) {
        // Fallback: try finding by _id if frontend sent ObjectId
        const memberById = await Customer.findById(memberId);
        if (!memberById) throw new AppError('Member not found', 404);
        member = memberById; // Use found member
    }

    // 2. Create Payment Record (Immutable)
    const payment = await Payment.create({
        memberId: member.memberId, // Ensure we store the String ID
        amount,
        method: method || 'CASH',
        transactionRef,
        paymentDate: paymentDate || new Date(),
        receivedBy: req.user ? req.user.name : 'admin'
    });

    // 3. Recalculate Summary (The Fix)
    await PaymentService.recalculatePaymentSummary(member.memberId);

    // 4. Return Success
    // Fetch updated member to return fresh balance
    const updatedMember = await Customer.findOne({ memberId: member.memberId });

    sendSuccess(res, 201, {
        payment,
        member: updatedMember // Frontend often needs this to update UI
    }, 'Payment recorded successfully');
});

/**
 * @desc    Update payment
 * @route   PUT /api/payments/:id
 */
const updatePayment = asyncHandler(async (req, res, next) => {
    // Strict Immutability: Block updates.
    // Or allow ONLY admin to fix errors? 
    // For now, let's block it as per "Immutable Ledger" spec.
    // Use Delete + Re-create for errors.
    return next(new AppError('Payments are immutable. Delete and re-create if needed.', 405));
});

/**
 * @desc    Delete payment
 * @route   DELETE /api/payments/:id
 */
const deletePayment = asyncHandler(async (req, res, next) => {
    const payment = await Payment.findById(req.params.id);
    if (!payment) return next(new AppError('Payment not found', 404));

    const memberId = payment.memberId;

    await payment.deleteOne();

    // Recalculate summary after deletion
    await PaymentService.recalculatePaymentSummary(memberId);

    sendSuccess(res, 200, null, 'Payment deleted');
});

/**
 * @desc    Get stats
 */
const getPaymentStats = asyncHandler(async (req, res) => {
    // Simple stats
    const totalRevenue = await Payment.aggregate([
        { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);

    sendSuccess(res, 200, {
        totalRevenue: totalRevenue[0] ? totalRevenue[0].total : 0
    });
});

module.exports = {
    getPayments,
    getCustomerPayments,
    createPayment,
    updatePayment,
    deletePayment,
    getPaymentStats
};
