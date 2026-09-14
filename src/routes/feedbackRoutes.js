const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const {
  submitFeedback,
  getFeedback,
  submitComplaint,
  getUserComplaints,
  getComplaintStatus,
  getFeedbackStatus,
} = require('../controllers/feedbackController');

// Feedback routes
router.post('/feedback', requireAuth, submitFeedback);
router.get('/feedback/:orderId', requireAuth, getFeedback);
router.get('/orders/:orderId/feedback-status', requireAuth, getFeedbackStatus);

// Complaint routes
router.post('/complaints', requireAuth, submitComplaint);
router.get('/complaints', requireAuth, getUserComplaints);
router.get('/orders/:orderId/complaint-status', requireAuth, getComplaintStatus);

module.exports = router;
