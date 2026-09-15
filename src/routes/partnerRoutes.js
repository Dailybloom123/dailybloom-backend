const express = require('express');
const router = express.Router();
const partnerController = require('../controllers/partnerController');
const { authenticate } = require('../middleware/auth');

// Available orders for first-come-first-serve acceptance
router.get('/available-orders', authenticate, partnerController.getAvailableOrders);
router.post('/accept-order/:id', authenticate, partnerController.acceptOrder);
router.post('/reject-order/:id', authenticate, partnerController.rejectOrder);

// Partner's assigned orders
router.get('/orders', authenticate, partnerController.getPartnerOrders);
router.patch('/orders/:id/status', authenticate, partnerController.updateOrderStatus);

// Product stock management (real-time sync to customer portal)
router.patch('/products/:id/stock', authenticate, partnerController.updateProductStock);

// Mark product out of stock
router.post('/products/:id/out-of-stock', authenticate, partnerController.updateProductStock);

// Accept order (for admin portal compatibility)
router.patch('/orders/:id/accept', authenticate, partnerController.acceptOrder);

module.exports = router;
