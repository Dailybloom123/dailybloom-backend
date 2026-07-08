const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { createSubscription, listSubscriptions, updateSubscription } = require('../controllers/subscriptionController');

router.use(requireAuth);

router.post('/', createSubscription);
router.get('/', listSubscriptions);
router.patch('/:id', updateSubscription);

module.exports = router;
