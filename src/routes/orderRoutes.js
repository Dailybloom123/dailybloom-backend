const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { createOrder, listOrders, getOrder, confirmOrderStock, releaseOrderStock, cancelOrder, verifyOrderDelivery } = require('../controllers/orderController');
const { validate, schemas } = require('../middleware/validate');

// Every order route requires a logged-in user
router.use(requireAuth);

router.post('/', validate(schemas.createOrder), createOrder);
router.get('/', listOrders);
router.get('/:id', getOrder);
router.post('/:id/confirm-stock', confirmOrderStock);
router.post('/:id/release-stock', releaseOrderStock);
router.delete('/:id', cancelOrder);
router.patch('/:id/verify-delivery', verifyOrderDelivery);

module.exports = router;
