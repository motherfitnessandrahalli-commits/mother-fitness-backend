const { Payment, Customer } = require('../models');
const { AppError, asyncHandler, sendSuccess } = require('../utils/errorHandler');
const { paginate, createPaginationMeta } = require('../utils/helpers');
const { getIO } = require('../config/socket');
const SyncService = require('../services/SyncService');

/**
 * @desc    Get all payments with filtering and pagination
 * @route   GET /api/payments
 * @access  Private (Admin/Staff)
 */
const getPayments = asyncHandler(async (req, res, next) => {
    const {
        page = 1,
        limit = 10,
        customerId,
        status,
        sortBy = 'paymentDate',
        order = 'desc'
    } = req.query;

    const query = {};

    // Filter by customer
    if (customerId) {
        query.customerId = customerId;
    }

    // Filter by status
    if (status) {
        query.status = status;
    }

    const { skip, limit: limitParsed } = paginate(page, limit);

    // Sorting
    const sort = {};
    sort[sortBy] = order === 'asc' ? 1 : -1;

    const payments = await Payment.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limitParsed)
        .populate('customerId', 'name email phone plan')
        .populate('addedBy', 'name email');

    const total = await Payment.countDocuments(query);

    sendSuccess(res, 200, {
        payments,
        pagination: createPaginationMeta(total, page, limitParsed),
    });
});

/**
 * @desc    Get payments for a specific customer
 * @route   GET /api/payments/customer/:customerId
 * @access  Private (Admin/Staff)
 */
const getCustomerPayments = asyncHandler(async (req, res, next) => {
    const { customerId } = req.params;

    const payments = await Payment.find({ customerId })
        .sort({ paymentDate: -1 })
        .populate('addedBy', 'name email');

    sendSuccess(res, 200, { payments });
});

/**
 * @desc    Create new payment record
 * @route   POST /api/payments
 * @access  Private (Admin/Staff)
 */
const createPayment = asyncHandler(async (req, res, next) => {
    const {
        customerId,
        amount,
        paymentDate,
        paymentMethod,
        receiptNumber,
        planType,
        status,
        notes,
        balance // Extract balance
    } = req.body;

    // Verify customer exists
    const customer = await Customer.findById(customerId);
    if (!customer) {
        return next(new AppError('Customer not found', 404));
    }

    // Calculate new validity
    let startDate = new Date(paymentDate || new Date());
    const currentValidity = new Date(customer.validity);
    const today = new Date();

    // If customer is currently active (validity > today), extend from current validity
    if (currentValidity > today) {
        startDate = currentValidity;
    }

    const endDate = new Date(startDate);
    switch (planType) {
        case 'Monthly':
            endDate.setMonth(endDate.getMonth() + 1);
            break;
        case 'Quarterly':
            endDate.setMonth(endDate.getMonth() + 3);
            break;
        case 'Half-Yearly':
            endDate.setMonth(endDate.getMonth() + 6);
            break;
        case 'Yearly':
            endDate.setMonth(endDate.getMonth() + 12);
            break;
        default:
            endDate.setMonth(endDate.getMonth() + 1); // Default to monthly
    }

    // Update customer plan and validity
    customer.plan = planType;
    customer.validity = endDate;

    // Update balance if provided
    if (balance !== undefined && balance !== '') {
        customer.balance = balance;
    }

    await customer.save();

    // Create payment
    const payment = await Payment.create({
        customerId,
        customerName: customer.name,
        amount,
        paymentDate: paymentDate || new Date(),
        paymentMethod,
        receiptNumber,
        planType,
        status: (balance > 0) ? 'pending' : (status || 'completed'),
        notes,
        addedBy: req.user.id,
    });

    // Log payment events to timeline
    const timeline = require('../services/TimelineService');
    await timeline.logEvent(
        customerId,
        'PAYMENT',
        `Payment of ₹${amount} Received`,
        `Paid via ${paymentMethod} for ${planType} plan.`
    );

    // If it's a plan renewal (already handled in validity logic above)
    await timeline.logEvent(
        customerId,
        'RENEWED',
        'Membership Renewed',
        `Plan extended to ${new Date(endDate).toLocaleDateString()}. New Plan: ${planType}`
    );

    // Broadcast real-time update
    try {
        const { getIO } = require('../config/socket');
        const io = getIO();
        io.emit('payment:new', payment);
        io.emit('customer:updated', customer);
    } catch (error) {
        console.error('Socket emit error:', error.message);
    }

    // Convert customer to plain object to ensure all fields are sent
    const customerData = customer.toObject();

    // 🔄 CLOUD SYNC: Push Payment to Cloud DB
    // We need the customer object for mapping
    if (customer) {
        SyncService.syncPayment(payment, customer).catch(err => console.error('Sync Error:', err.message));
    }

    sendSuccess(res, 201, { payment, customer: customerData }, 'Payment recorded and plan updated successfully');
});

/**
 * @desc    Update payment record
 * @route   PUT /api/payments/:id
 * @access  Private (Admin/Staff)
 */
const updatePayment = asyncHandler(async (req, res, next) => {
    let payment = await Payment.findById(req.params.id);

    if (!payment) {
        return next(new AppError('Payment not found', 404));
    }

    payment = await Payment.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true,
    });

    sendSuccess(res, 200, { payment }, 'Payment updated successfully');
});

/**
 * @desc    Delete payment record
 * @route   DELETE /api/payments/:id
 * @access  Private (Admin only)
 */
const deletePayment = asyncHandler(async (req, res, next) => {
    const payment = await Payment.findById(req.params.id);

    if (!payment) {
        return next(new AppError('Payment not found', 404));
    }

    await payment.deleteOne();

    sendSuccess(res, 200, null, 'Payment deleted successfully');
});

/**
 * @desc    Get payment statistics
 * @route   GET /api/payments/stats/overview
 * @access  Private (Admin/Staff)
 */
const getPaymentStats = asyncHandler(async (req, res, next) => {
    const totalPayments = await Payment.countDocuments({ status: { $in: ['completed', 'pending'] } });

    // Calculate total revenue
    const revenueData = await Payment.aggregate([
        { $match: { status: { $in: ['completed', 'pending'] } } },
        { $group: { _id: null, totalRevenue: { $sum: '$amount' } } }
    ]);

    const totalRevenue = revenueData.length > 0 ? revenueData[0].totalRevenue : 0;

    // Get pending payments count
    const pendingPayments = await Payment.countDocuments({ status: 'pending' });

    // Monthly revenue (current month)
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const monthlyData = await Payment.aggregate([
        {
            $match: {
                status: { $in: ['completed', 'pending'] },
                paymentDate: { $gte: startOfMonth }
            }
        },
        { $group: { _id: null, monthlyRevenue: { $sum: '$amount' } } }
    ]);

    const monthlyRevenue = monthlyData.length > 0 ? monthlyData[0].monthlyRevenue : 0;

    sendSuccess(res, 200, {
        totalPayments,
        totalRevenue,
        pendingPayments,
        monthlyRevenue,
    });
});

module.exports = {
    getPayments,
    getCustomerPayments,
    createPayment,
    updatePayment,
    deletePayment,
    getPaymentStats,
};
