const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../middleware/adminAuth');
const { listAllOrders, updateOrderStatus, getStats } = require('../controllers/adminController');

router.use(requireAdmin);

router.get('/orders', listAllOrders);
router.patch('/orders/:id', updateOrderStatus);
router.get('/stats', getStats);

module.exports = router;
