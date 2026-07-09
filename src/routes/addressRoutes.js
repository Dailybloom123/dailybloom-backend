const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { createAddress, listAddresses } = require('../controllers/addressController');

router.use(requireAuth);

router.post('/', createAddress);
router.get('/', listAddresses);

module.exports = router;
