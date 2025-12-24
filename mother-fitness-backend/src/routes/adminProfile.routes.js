const express = require('express');
const {
    getAdminProfile,
    updateAdminProfile
} = require('../controllers/adminProfileController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Protect all routes
router.use(protect);

router.get('/', getAdminProfile);
router.put('/', updateAdminProfile);
router.post('/verify', require('../controllers/adminProfileController').verifyPassword);

module.exports = router;
