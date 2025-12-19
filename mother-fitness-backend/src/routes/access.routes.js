const express = require('express');
const { verifyAccess, connectDoor, getPorts } = require('../controllers/accessController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Public verification (can be called by a standalone device without token if we wanted, 
// but for security we keep it protected or use a special device secret. 
// For now, keeping it consistent with the system.)
router.post('/verify', verifyAccess);

// Admin only routes for hardware setup
router.use(protect);
router.post('/connect', connectDoor);
router.get('/ports', getPorts);

module.exports = router;
