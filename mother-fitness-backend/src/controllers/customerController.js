const { Customer, Payment } = require('../models');
const { AppError, asyncHandler, sendSuccess } = require('../utils/errorHandler');
const { paginate, createPaginationMeta, calculatePlanValidity } = require('../utils/helpers');
const SyncService = require('../services/SyncService');

/**
 * @desc    Get all customers with filter, search, and pagination
 * @route   GET /api/customers
 * @access  Private
 */
const getCustomers = asyncHandler(async (req, res, next) => {
    const {
        page = 1,
        limit = 10,
        search,
        status,
        plan,
        sortBy = 'createdAt',
        order = 'desc'
    } = req.query;

    // Build query
    const query = {};

    // Search by name, email, or phone
    if (search) {
        query.$or = [
            { name: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } },
            { phone: { $regex: search, $options: 'i' } },
        ];
    }

    // Filter by plan
    if (plan) {
        query.plan = plan;
    }

    // Filter by status (requires special handling due to virtual field)
    // Note: Virtual fields cannot be queried directly in MongoDB. 
    // For a real app with large data, we should store status in DB and update it via cron job.
    // For this implementation, we'll fetch data and filter in memory if status filter is applied,
    // OR we can query based on validity date which maps to status.

    if (status) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (status === 'active') {
            // Validity > today + 7 days
            const nextWeek = new Date(today);
            nextWeek.setDate(nextWeek.getDate() + 7);
            query.validity = { $gt: nextWeek };
        } else if (status === 'expiring') {
            // Validity between today and today + 7 days
            const nextWeek = new Date(today);
            nextWeek.setDate(nextWeek.getDate() + 7);
            query.validity = { $gte: today, $lte: nextWeek };
        } else if (status === 'expired') {
            // Validity < today
            query.validity = { $lt: today };
        }
    }

    // Pagination
    const { skip, limit: limitParsed } = paginate(page, limit);

    // Sorting
    const sort = {};
    sort[sortBy] = order === 'asc' ? 1 : -1;

    // Execute query
    const customers = await Customer.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limitParsed)
        .populate('createdBy', 'name email');

    // Get total count
    const total = await Customer.countDocuments(query);

    sendSuccess(res, 200, {
        customers,
        pagination: createPaginationMeta(total, page, limitParsed),
    });
});

/**
 * @desc    Get single customer
 * @route   GET /api/customers/:id
 * @access  Private
 */
const getCustomer = asyncHandler(async (req, res, next) => {
    const customer = await Customer.findById(req.params.id).populate('createdBy', 'name email');

    if (!customer) {
        return next(new AppError('Customer not found', 404));
    }

    sendSuccess(res, 200, { customer });
});

/**
 * @desc    Create new customer
 * @route   POST /api/customers
 * @access  Private
 */
const createCustomer = asyncHandler(async (req, res, next) => {
    const { name, age, email, phone, plan, balance, notes, photo, validity, memberId, password, isFirstLogin, initialPayment } = req.body;

    // Calculate validity if not provided
    let validityDate = validity;
    if (!validityDate) {
        validityDate = calculatePlanValidity(plan);
    }

    const customer = await Customer.create({
        name,
        age,
        email,
        phone,
        plan,
        balance,
        validity: validityDate,
        notes,
        photo,
        memberId,
        password,
        isFirstLogin,
        createdBy: req.user.id,
    });

    // Log join event to timeline
    const timeline = require('../services/TimelineService');
    await timeline.logEvent(
        customer._id,
        'JOINED',
        'Joined Mother Fitness Gym',
        `Registered for ${customer.plan} plan starting today.`
    );

    let payment = null;

    // Handle Initial Payment
    if (initialPayment && initialPayment.amount) {
        try {
            payment = await Payment.create({
                customerId: customer._id,
                customerName: customer.name,
                planType: customer.plan,
                amount: initialPayment.amount,
                paymentMethod: initialPayment.paymentMethod || 'Cash',
                receiptNumber: initialPayment.receiptNumber,
                paymentDate: new Date(),
                status: (balance > 0) ? 'pending' : 'completed',
                addedBy: req.user.id
            });
        } catch (error) {
            console.error('Failed to create initial payment:', error);
            // We don't fail the customer creation if payment fails, 
            // but we log it. User can add payment manually later.
        }
    }

    // Broadcast real-time update
    try {
        const { getIO } = require('../config/socket');
        const io = getIO();
        io.emit('customer:new', customer);
        io.emit('dashboard:update', { type: 'customer' });

        if (payment) {
            io.emit('payment:new', payment);
            io.emit('dashboard:update', { type: 'payment' });
        }
    } catch (error) {
        console.error('Socket emit error:', error.message);
    }

    // 🔄 CLOUD SYNC: Push Customer to Cloud DB
    console.log(`☁️ Initiating cloud sync for new member: ${customer.memberId}`);

    // Log to timeline
    const timeline = require('../services/TimelineService');
    const paymentStatus = (balance > 0) ? 'Pending' : 'Completed';
    await timeline.logEvent(
        customer._id,
        'JOINED',
        `Member Joined - [${paymentStatus}] Initial Payment of ₹${initialPayment ? initialPayment.amount : 0}`,
        `Paid via ${initialPayment ? initialPayment.paymentMethod : 'N/A'}. Plan: ${customer.plan}. Balance: ₹${customer.balance}`,
        { status: (balance > 0) ? 'pending' : 'completed' }
    );

    SyncService.syncMember(customer).then(async () => {
        if (payment) {
            console.log(`☁️ Initiating cloud sync for initial payment: ${customer.memberId}`);
            await SyncService.syncPayment(payment, customer);
        }
    }).catch(err => console.error('Sync Error:', err.message));

    sendSuccess(res, 201, { customer, payment }, 'Customer created successfully');
});

/**
 * @desc    Update customer
 * @route   PUT /api/customers/:id
 * @access  Private
 */
const updateCustomer = asyncHandler(async (req, res, next) => {
    let customer = await Customer.findById(req.params.id);

    if (!customer) {
        return next(new AppError('Customer not found', 404));
    }

    // Update fields
    customer = await Customer.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true,
    });

    // 🔄 CLOUD SYNC: Update Customer in Cloud DB
    SyncService.syncMember(customer).catch(err => console.error('Sync Error:', err.message));

    sendSuccess(res, 200, { customer }, 'Customer updated successfully');
});

/**
 * @desc    Delete customer
 * @route   DELETE /api/customers/:id
 * @access  Private (Admin/Manager only or Creator)
 */
const deleteCustomer = asyncHandler(async (req, res, next) => {
    const customer = await Customer.findById(req.params.id);

    if (!customer) {
        return next(new AppError('Customer not found', 404));
    }

    // Optional: Check permissions (e.g., only admin or creator can delete)
    // if (req.user.role !== 'admin' && customer.createdBy.toString() !== req.user.id) {
    //     return next(new AppError('Not authorized to delete this customer', 403));
    // }

    await customer.deleteOne();

    sendSuccess(res, 200, null, 'Customer deleted successfully');
});

/**
 * @desc    Get customer stats
 * @route   GET /api/customers/stats/overview
 * @access  Private
 */
const getCustomerStats = asyncHandler(async (req, res, next) => {
    const total = await Customer.countDocuments();

    // Calculate status counts based on validity date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    const active = await Customer.countDocuments({ validity: { $gt: nextWeek } });
    const expiring = await Customer.countDocuments({ validity: { $gte: today, $lte: nextWeek } });
    const expired = await Customer.countDocuments({ validity: { $lt: today } });

    sendSuccess(res, 200, {
        total,
        active,
        expiring,
        expired
    });
});

/**
 * @desc    Sync badges for all customers (Retroactive sync)
 * @route   POST /api/customers/sync-badges
 * @access  Private (Admin)
 */
const syncBadges = asyncHandler(async (req, res, next) => {
    const customers = await Customer.find({});
    let updatedCount = 0;

    const BADGE_MILESTONES = {
        'Bronze': 10,
        'Silver': 30,
        'Gold': 60,
        'Beast Mode': 120
    };
    const badges = ['Bronze', 'Silver', 'Gold', 'Beast Mode'];

    for (const customer of customers) {
        let changed = false;

        // Ensure badgesEarned is initialized
        if (!customer.badgesEarned) {
            customer.badgesEarned = [];
        }

        for (const badge of badges) {
            const threshold = BADGE_MILESTONES[badge];
            if (customer.totalVisits >= threshold && !customer.badgesEarned.includes(badge)) {
                customer.badgesEarned.push(badge);
                changed = true;
            }
        }

        if (changed) {
            await customer.save();
            updatedCount++;
        }
    }

    sendSuccess(res, 200, { updatedCount }, `Badge sync complete. Updated ${updatedCount} customers.`);
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
