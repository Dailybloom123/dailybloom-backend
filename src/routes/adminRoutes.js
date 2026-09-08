const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

// Existing Admin Endpoints
router.get('/orders', adminController.listAllOrders);
router.patch('/orders/:id', adminController.updateOrderStatus);
router.get('/stats', adminController.getStats);
router.get('/locality-summary', adminController.getLocalitySummary);

// NEW: Tripartite System Endpoints
router.post('/orders/:id/notify', adminController.triggerSemiAutoNotification);
router.post('/disputes/resolve', adminController.resolveDispute);

// NEW: Partner Management Endpoints
router.get('/partners', adminController.listPartners);
router.post('/partners', adminController.addPartner);
router.put('/partners/:id', adminController.updatePartner);
router.delete('/partners/:id', adminController.deletePartner);
router.patch('/orders/:id/assign', adminController.assignOrderToPartner);

// NEW: Complaint Management Endpoints
router.get('/complaints', adminController.getComplaints);
router.post('/complaints/:id/escalate', adminController.escalateComplaint);
router.post('/complaints/:id/resolve', adminController.resolveComplaintDirectly);
router.get('/partners/:id/warnings', adminController.getPartnerWarnings);

// NEW: Partner Warning System Endpoints (3-strike rule)
router.post('/partners/:id/warn', adminController.warnPartner);
router.post('/partners/:id/block', adminController.blockPartner);
router.post('/partners/:id/unblock', adminController.unblockPartner);

module.exports = router;