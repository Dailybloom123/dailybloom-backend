const express = require('express');
const router = express.Router();
const { listProducts, getProduct, updateProductStock, getLowStockProducts } = require('../controllers/productController');

// Browsing is public — no login required to see what's available
router.get('/', listProducts);
router.get('/:id', getProduct);

// Admin endpoints for stock management (protected by admin key in adminRoutes)
router.put('/admin/products/:id/stock', updateProductStock);
router.get('/admin/products/low-stock', getLowStockProducts);

module.exports = router;
