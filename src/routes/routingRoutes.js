const express = require('express');
const router = express.Router();
const routingController = require('../controllers/routingController');
const { authenticate, authorize } = require('../middleware/auth');

// Route an order based on fulfillment type
router.post('/route-order/:id', authenticate, routingController.routeOrder);

// Accept first-to-claim order (for florists)
router.post('/accept-first-claim/:id', authenticate, authorize('partner'), routingController.acceptFirstClaimOrder);

// Get available first-to-claim orders for a florist
router.get('/available-first-claim-orders', authenticate, authorize('partner'), routingController.getAvailableFirstClaimOrders);

// Get available delivery slots
router.get('/delivery-slots', routingController.getDeliverySlots);

// Get fulfillment type for a category
router.get('/fulfillment-types', routingController.getFulfillmentType);

module.exports = router;
