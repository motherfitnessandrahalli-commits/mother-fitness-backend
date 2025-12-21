const express = require('express');
const { syncData } = require('../controllers/syncController');

const router = express.Router();

// No protect middleware here because it uses a custom SYNC_KEY in headers
// This is for internal communication between Local and Cloud
router.post('/:type', syncData);

module.exports = router;
