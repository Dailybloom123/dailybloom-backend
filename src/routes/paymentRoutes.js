const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { createPaymentOrder, verifyPayment, handleWebhook, approveOrder, rejectOrder, updateOrderStatus } = require('../controllers/paymentController');

// Webhook endpoint (no auth required - Razorpay calls this directly)
router.post('/webhook', handleWebhook);

// Payment endpoints (require auth)
router.post('/create', requireAuth, createPaymentOrder);
router.post('/verify', requireAuth, verifyPayment);

// Admin endpoints for order approval (require admin auth)
router.post('/approve', requireAuth, approveOrder);
router.post('/reject', requireAuth, rejectOrder);

// Partner endpoint for order status updates
router.patch('/status', requireAuth, updateOrderStatus);

module.exports = router;
