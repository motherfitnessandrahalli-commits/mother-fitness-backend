/**
 * Get local date string in YYYY-MM-DD format
 * @param {Date} date - Date object (defaults to current date)
 * @returns {string} Date string in YYYY-MM-DD format
 */
const getLocalDateString = (date = new Date()) => {
    return date.toLocaleDateString('en-CA', { // en-CA gives YYYY-MM-DD format
        timeZone: 'Asia/Kolkata'
    });
};

/**
 * Get local time string in HH:MM AM/PM format
 * @param {Date} date - Date object (defaults to current date)
 * @returns {string} Time string in HH:MM AM/PM format
 */
const getLocalTimeString = (date = new Date()) => {
    return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Kolkata'
    });
};

/**
 * Calculate plan validity date based on plan type
 * @param {string} planType - Plan type (Monthly, Quarterly, Half-Yearly, Yearly)
 * @param {Date} startDate - Start date (defaults to current date)
 * @returns {Date} Validity end date
 */
const calculatePlanValidity = (planType, startDate = new Date()) => {
    const validityDate = new Date(startDate);

    switch (planType) {
        case 'Monthly':
            validityDate.setMonth(validityDate.getMonth() + 1);
            break;
        case 'Quarterly':
            validityDate.setMonth(validityDate.getMonth() + 3);
            break;
        case 'Half-Yearly':
            validityDate.setMonth(validityDate.getMonth() + 6);
            break;
        case 'Yearly':
            validityDate.setFullYear(validityDate.getFullYear() + 1);
            break;
        default:
            validityDate.setMonth(validityDate.getMonth() + 1);
    }

    return validityDate;
};

/**
 * Generate unique ID with prefix
 * @param {string} prefix - ID prefix (e.g., 'cust', 'att')
 * @returns {string} Unique ID
 */
const generateUniqueId = (prefix = 'id') => {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Paginate query results
 * @param {Object} query - Mongoose query object
 * @param {number} page - Page number (1-indexed)
 * @param {number} limit - Items per page
 * @returns {Object} Pagination metadata
 */
const paginate = (page = 1, limit = 10) => {
    const skip = (page - 1) * limit;
    return { skip, limit: parseInt(limit) };
};

/**
 * Create pagination metadata
 * @param {number} total - Total items
 * @param {number} page - Current page
 * @param {number} limit - Items per page
 * @returns {Object} Pagination metadata
 */
const createPaginationMeta = (total, page, limit) => {
    const totalPages = Math.ceil(total / limit);
    return {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
    };
};

module.exports = {
    getLocalDateString,
    getLocalTimeString,
    calculatePlanValidity,
    generateUniqueId,
    paginate,
    createPaginationMeta,
};
