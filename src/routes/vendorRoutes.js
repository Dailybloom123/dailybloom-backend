const express = require('express');
const router = express.Router();
const { listVendors, getVendorProducts } = require('../controllers/vendorController');

router.get('/', listVendors);
router.get('/:id/products', getVendorProducts);

module.exports = router;
