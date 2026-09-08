const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/adminAuth');
const { createRefund, getUserRefunds, getAllRefunds, approveRefund, rejectRefund } = require('../controllers/refundController');

// Customer routes (require user auth)
router.post('/', requireAuth, createRefund);
router.get('/', requireAuth, getUserRefunds);

// Admin routes (require admin key)
router.get('/admin/all', requireAdmin, getAllRefunds);
router.put('/admin/:id/approve', requireAdmin, approveRefund);
router.put('/admin/:id/reject', requireAdmin, rejectRefund);

module.exports = router;