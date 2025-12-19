const express = require('express');
const {
    getDashboardStats,
    getPlanPopularity,
    getAgeDemographics,
    getBusinessGrowth
} = require('../controllers/analyticsController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Protect all routes
router.use(protect);

router.get('/dashboard', getDashboardStats);
router.get('/plans', getPlanPopularity);
router.get('/demographics', getAgeDemographics);
router.get('/growth', getBusinessGrowth);

module.exports = router;
