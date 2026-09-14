const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cartController');
const { authenticate } = require('../middleware/auth');

// Group cart items by delivery slot
router.post('/group-by-slot', authenticate, cartController.groupCartBySlot);

// Update delivery slot for a cart item
router.post('/update-item-slot', authenticate, cartController.updateCartItemSlot);

// Create split orders from multi-slot cart
router.post('/create-split-orders', authenticate, cartController.createSplitOrders);

// Get all available delivery slots
router.get('/delivery-slots', cartController.getDeliverySlots);

// Get cart summary with slot breakdown
router.get('/summary', cartController.getCartSummary);

module.exports = router;
