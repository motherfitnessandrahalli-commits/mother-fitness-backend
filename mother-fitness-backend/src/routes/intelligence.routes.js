const express = require('express');
const { getMemberTimeline, getBusinessHealth } = require('../controllers/intelligenceController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.get('/timeline/:customerId', getMemberTimeline);
router.get('/business-health', getBusinessHealth);

module.exports = router;
