const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { createOrder, listOrders, getOrder } = require('../controllers/orderController');

// Every order route requires a logged-in user
router.use(requireAuth);

router.post('/', createOrder);
router.get('/', listOrders);
router.get('/:id', getOrder);

module.exports = router;
