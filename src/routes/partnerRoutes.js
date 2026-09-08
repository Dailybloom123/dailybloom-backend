const express = require('express');
const router = express.Router();
const partnerController = require('../controllers/partnerController');
const { authenticate, authorize } = require('../middleware/auth');

// Available orders for first-come-first-serve acceptance
router.get('/available-orders', authenticate, authorize('partner'), partnerController.getAvailableOrders);
router.post('/accept-order/:id', authenticate, authorize('partner'), partnerController.acceptOrder);

// Partner's assigned orders
router.get('/orders', authenticate, authorize('partner'), partnerController.getPartnerOrders);
router.patch('/orders/:id/status', authenticate, authorize('partner'), partnerController.updateOrderStatus);

module.exports = router;
