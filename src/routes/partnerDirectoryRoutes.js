const express = require('express');
const router = express.Router();
const {
  getPublicPartners,
  getPartnerBySlug,
  getPartnerProducts
} = require('../controllers/partnerDirectoryController');

// Public routes (no authentication required)
router.get('/', getPublicPartners);
router.get('/slug/:slug', getPartnerBySlug);
router.get('/:partnerId/products', getPartnerProducts);

module.exports = router;
