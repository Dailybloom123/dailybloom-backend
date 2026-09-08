const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const {
  getStockNotifications,
  createStockNotification,
  updateStockNotification,
  getPartnerStockNotifications,
  getLowStockAlerts
} = require('../controllers/stockCommunicationController');

// Admin routes
router.get('/notifications', authenticate, authorize('admin'), getStockNotifications);
router.get('/low-stock', authenticate, authorize('admin'), getLowStockAlerts);
router.patch('/notifications/:id', authenticate, authorize('admin'), updateStockNotification);

// Partner routes
router.post('/notifications', authenticate, authorize('partner'), createStockNotification);
router.get('/notifications', authenticate, authorize('partner'), getPartnerStockNotifications);

module.exports = router;