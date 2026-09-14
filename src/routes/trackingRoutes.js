const express = require('express');
const router = express.Router();
const {
  startTracking,
  updateLocation,
  getTrackingHistory,
  getLatestLocation,
  getMilestones,
  addMilestone,
  stopTracking
} = require('../controllers/trackingController');

// Partner routes (require partner authentication)
router.post('/start', startTracking);
router.post('/location', updateLocation);
router.post('/:order_id/milestone', addMilestone);
router.post('/:order_id/stop', stopTracking);

// Customer and Admin routes (require appropriate authentication)
router.get('/:order_id/history', getTrackingHistory);
router.get('/:order_id/latest', getLatestLocation);
router.get('/:order_id/milestones', getMilestones);

module.exports = router;