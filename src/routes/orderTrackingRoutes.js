const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const {
  getOrderById,
  updateOrderStatus,
  assignOrderToPartner,
  getOrdersByStatus,
  getOrderTracking,
  getOrderUpdates
} = require('../controllers/orderTrackingController');

// Get real-time order updates (for polling) - must be before /:id
router.get('/updates', authenticate, getOrderUpdates);

// Get orders by status (admin and partner) - must be before /:id
router.get('/status/:status', authenticate, authorize('admin', 'partner'), getOrdersByStatus);

// Get order by ID (all authenticated users can access their own orders)
router.get('/:id', authenticate, getOrderById);

// Update order status (admin and partner)
router.patch('/:id/status', authenticate, authorize('admin', 'partner'), updateOrderStatus);

// Assign order to partner (admin only)
router.patch('/:id/assign', authenticate, authorize('admin'), assignOrderToPartner);

// Get order tracking timeline (all authenticated users)
router.get('/:id/tracking', authenticate, getOrderTracking);

module.exports = router;