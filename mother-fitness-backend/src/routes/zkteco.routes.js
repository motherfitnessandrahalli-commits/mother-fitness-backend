const express = require('express');
const {
    connectDevice,
    disconnectDevice,
    getDeviceStatus,
    enrollMember,
    removeMember,
    syncAllMembers,
    getEnrolledUsers,
    getAttendanceLogs,
    processAttendance,
    clearAttendanceLogs
} = require('../controllers/zktecoController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// All routes require admin authentication
router.use(protect);

// Device management
router.post('/connect', connectDevice);
router.post('/disconnect', disconnectDevice);
router.get('/status', getDeviceStatus);

// Member enrollment
router.post('/enroll-member', enrollMember);
router.delete('/remove-member/:customerId', removeMember);
router.post('/sync-all-members', syncAllMembers);
router.get('/enrolled-users', getEnrolledUsers);

// Attendance
router.get('/attendance-logs', getAttendanceLogs);
router.post('/process-attendance', processAttendance);
router.post('/clear-logs', clearAttendanceLogs);

module.exports = router;
