const express = require('express');
const router = express.Router();
const { handleRazorpayWebhook } = require('../controllers/webhookController');

// No auth middleware here — Razorpay's servers call this directly,
// they can't send a JWT. Security comes from the signature check inside
// handleRazorpayWebhook instead.
router.post('/razorpay', handleRazorpayWebhook);

module.exports = router;
