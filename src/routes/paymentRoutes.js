const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { createPaymentOrder, verifyPayment } = require('../controllers/paymentController');

router.use(requireAuth);

router.post('/create', createPaymentOrder);
router.post('/verify', verifyPayment);

module.exports = router;
