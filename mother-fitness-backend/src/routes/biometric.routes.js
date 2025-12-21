const express = require('express');
const { mockBiometricEvent } = require('../controllers/biometricController');

const router = express.Router();

// Public mock endpoint for testing simulation
router.post('/mock', mockBiometricEvent);

module.exports = router;
