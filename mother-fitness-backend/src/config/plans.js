/**
 * Membership Plan Definitions - Source of Truth
 */

const PLANS = {
    'Monthly': {
        id: 'PLAN_MONTHLY',
        name: 'Monthly',
        durationDays: 30,
        amount: 800
    },
    'Quarterly': {
        id: 'PLAN_QUARTERLY',
        name: 'Quarterly',
        durationDays: 90,
        amount: 2200
    },
    'Half-Yearly': {
        id: 'PLAN_HALF_YEARLY',
        name: 'Half-Yearly',
        durationDays: 180,
        amount: 4000
    },
    'Yearly': {
        id: 'PLAN_YEARLY',
        name: 'Yearly',
        durationDays: 365,
        amount: 7000
    }
};

const getPlan = (planName) => {
    return PLANS[planName] || PLANS['Monthly']; // Fallback safe
};

module.exports = {
    PLANS,
    getPlan
};
