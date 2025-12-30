const express = require('express');
const { mockBiometricEvent, processBiometricEvent } = require('../controllers/biometricController');

const router = express.Router();

// Production endpoint for real hardware devices
router.post('/event', processBiometricEvent);

// Public mock endpoint for testing simulation
router.post('/mock', mockBiometricEvent);

module.exports = router;
