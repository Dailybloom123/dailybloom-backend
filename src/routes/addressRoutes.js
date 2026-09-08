const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { createAddress, listAddresses, setDefaultAddress, deleteAddress, listArchivedAddresses, restoreAddress, permanentDeleteAddress } = require('../controllers/addressController');

router.use(requireAuth);

router.post('/', createAddress);
router.get('/', listAddresses);
router.get('/archived', listArchivedAddresses);
router.patch('/:id/default', setDefaultAddress);
router.post('/:id/restore', restoreAddress);
router.delete('/:id', deleteAddress);
router.delete('/:id/permanent', permanentDeleteAddress);

module.exports = router;
