const express = require('express');
const router = express.Router();
const {
  createPause,
  getSubscriptionPauses,
  deletePause,
  isSubscriptionPaused
} = require('../controllers/subscriptionPauseController');
const { authenticate } = require('../middleware/auth');

// Customer routes
router.post('/', authenticate, createPause);
router.get('/subscription/:subscriptionId', authenticate, getSubscriptionPauses);
router.delete('/:pauseId', authenticate, deletePause);
router.get('/is-paused/:subscriptionId', authenticate, isSubscriptionPaused);

module.exports = router;
