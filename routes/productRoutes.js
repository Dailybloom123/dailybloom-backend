const express = require('express');
const router = express.Router();
const { listProducts, getProduct } = require('../controllers/productController');

// Browsing is public — no login required to see what's available
router.get('/', listProducts);
router.get('/:id', getProduct);

module.exports = router;
