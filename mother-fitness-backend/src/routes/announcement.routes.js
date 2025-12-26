const express = require('express');
const {
    createAnnouncement,
    getAllAnnouncements,
    getActiveAnnouncements,
    deleteAnnouncement
} = require('../controllers/announcementController');
const { protect, restrictTo } = require('../middleware/auth');
const noCache = require('../middleware/cacheControl');

const router = express.Router();

// Public/Member Routes (Protected but accessible to all roles)
// ✅ No caching for announcements
router.get('/active', noCache, protect, getActiveAnnouncements);

// Admin Routes
router.use(protect);
router.use(restrictTo('admin'));

router.route('/')
    .get(getAllAnnouncements)  // Get all announcements
    .post(createAnnouncement); // Create new announcement

router.route('/:id')
    .delete(deleteAnnouncement);

module.exports = router;
