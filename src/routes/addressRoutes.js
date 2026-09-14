const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { createAddress, listAddresses, setDefaultAddress, deleteAddress, updateAddress, listArchivedAddresses, restoreAddress, permanentDeleteAddress } = require('../controllers/addressController');

router.use(authenticate);

router.post('/', createAddress);
router.get('/', listAddresses);
router.get('/archived', listArchivedAddresses);
router.patch('/:id/default', setDefaultAddress);
router.put('/:id', updateAddress);
router.post('/:id/restore', restoreAddress);
router.delete('/:id', deleteAddress);
router.delete('/:id/permanent', permanentDeleteAddress);

module.exports = router;
