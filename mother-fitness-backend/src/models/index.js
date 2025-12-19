// Export all models from a single file for easy imports
const User = require('./User');
const Customer = require('./Customer');
const Attendance = require('./Attendance');
const Payment = require('./Payment');
const TimelineEvent = require('./TimelineEvent');

module.exports = {
    User,
    Customer,
    Attendance,
    Payment,
    TimelineEvent
};
