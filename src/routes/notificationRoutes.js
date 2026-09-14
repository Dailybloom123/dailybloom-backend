const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { getNotifications, markAsRead, markAllAsRead } = require('../controllers/notificationController');

// Every notification route requires a logged-in user
router.use(requireAuth);

router.get('/', getNotifications);
router.post('/:id/read', markAsRead);
router.post('/mark-all-read', markAllAsRead);

module.exports = router;
