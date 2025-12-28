const Joi = require('joi');
const { AppError } = require('../utils/errorHandler');

/**
 * Validate request body against Joi schema
 * @param {Object} schema - Joi schema
 */
const validate = (schema) => {
    return (req, res, next) => {
        const { error } = schema.validate(req.body, { abortEarly: false });

        if (error) {
            const errorMessage = error.details.map((detail) => detail.message).join(', ');
            return next(new AppError(errorMessage, 400));
        }

        next();
    };
};

// Customer Validation Schemas
const customerSchemas = {
    create: Joi.object({
        name: Joi.string().required().trim().min(2).max(50),
        age: Joi.number().required().min(10).max(120),
        email: Joi.string().email().required().trim(),
        phone: Joi.string().required().pattern(/^[0-9+\-\s()]*$/).min(10).max(15),
        plan: Joi.string().required().valid('Monthly', 'Quarterly', 'Half-Yearly', 'Yearly'),
        balance: Joi.number().optional().default(0),
        validity: Joi.date().iso(),
        notes: Joi.string().allow('').max(500),
        photo: Joi.string().allow('').optional(), // Allow any string (URL or base64)
        // Member authentication fields (optional)
        memberId: Joi.string().trim().min(3).max(20).allow('').optional(),
        password: Joi.string().min(4).max(100).optional(),
        isFirstLogin: Joi.boolean().optional(),
        initialPayment: Joi.object({
            amount: Joi.number().required(),
            method: Joi.string().valid('CASH', 'UPI', 'CARD', 'BANK_TRANSFER').default('CASH'),
            receiptNumber: Joi.string().allow('').optional()
        }).optional(),
    }),

    update: Joi.object({
        name: Joi.string().trim().min(2).max(50),
        age: Joi.number().min(10).max(120),
        email: Joi.string().email().trim(),
        phone: Joi.string().pattern(/^[0-9+\-\s()]*$/).min(10).max(15),
        plan: Joi.string().valid('Monthly', 'Quarterly', 'Half-Yearly', 'Yearly'),
        balance: Joi.number().optional(),
        validity: Joi.date().iso(),
        notes: Joi.string().allow('').max(500),
        photo: Joi.string().allow('').optional(), // Allow any string (URL or base64)
        // Member authentication fields (optional)
        memberId: Joi.string().trim().min(3).max(20).allow('').optional(),
        password: Joi.string().min(4).max(100).optional(),
        isFirstLogin: Joi.boolean().optional(),
    }).min(1), // At least one field must be provided
};

module.exports = {
    validate,
    customerSchemas,
};
