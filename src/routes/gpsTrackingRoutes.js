const express = require('express');
const router = express.Router();
const gpsTrackingController = require('../controllers/gpsTrackingController');
const { authenticate, authorize } = require('../middleware/auth');

// Start GPS tracking (for vendors)
router.post('/start-tracking/:orderId', authenticate, authorize('partner'), gpsTrackingController.startGPSTracking);

// Stop GPS tracking (for vendors)
router.post('/stop-tracking/:orderId', authenticate, authorize('partner'), gpsTrackingController.stopGPSTracking);

// Update GPS coordinates (for vendors)
router.post('/update-location/:orderId', authenticate, authorize('partner'), gpsTrackingController.updateGPSCoordinates);

// Get GPS coordinates (for customers)
router.get('/coordinates/:orderId', authenticate, gpsTrackingController.getGPSCoordinates);

// Get order tracking status (for customers)
router.get('/order-status/:orderId', authenticate, gpsTrackingController.getOrderTrackingStatus);

module.exports = router;
