const express = require('express');
const router = express.Router();
const complaintController = require('../controllers/complaintController');
const { authenticate, authorize } = require('../middleware/auth');

// Complaint routes
router.get('/complaints', authenticate, authorize('admin'), complaintController.getComplaints);
router.get('/complaints/:id', authenticate, authorize('admin'), complaintController.getComplaintById);
router.post('/complaints', authenticate, authorize('customer'), complaintController.createComplaint);
router.patch('/complaints/:id', authenticate, authorize('admin'), complaintController.updateComplaint);

// Feedback routes
router.get('/feedback', authenticate, authorize('admin'), complaintController.getFeedback);
router.get('/feedback/:id', authenticate, authorize('admin'), complaintController.getFeedbackById);
router.post('/feedback', authenticate, authorize('customer'), complaintController.createFeedback);

module.exports = router;