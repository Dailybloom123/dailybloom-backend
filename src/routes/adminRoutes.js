const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticate } = require('../middleware/auth');

// Existing Admin Endpoints
router.get('/orders', authenticate, adminController.listAllOrders);
router.patch('/orders/:id', authenticate, adminController.updateOrderStatus);
router.get('/stats', authenticate, adminController.getStats);
router.get('/locality-summary', authenticate, adminController.getLocalitySummary);

// NEW: Tripartite System Endpoints
router.post('/orders/:id/notify', authenticate, adminController.triggerSemiAutoNotification);
router.post('/disputes/resolve', authenticate, adminController.resolveDispute);

// NEW: Partner Management Endpoints
router.get('/partners', authenticate, adminController.listPartners);
router.post('/partners', authenticate, adminController.addPartner);
router.put('/partners/:id', authenticate, adminController.updatePartner);
router.delete('/partners/:id', authenticate, adminController.deletePartner);
router.patch('/orders/:id/assign', authenticate, adminController.assignOrderToPartner);

// NEW: Complaint Management Endpoints
router.get('/complaints', authenticate, adminController.getComplaints);
router.post('/complaints/:id/escalate', authenticate, adminController.escalateComplaint);
router.post('/complaints/:id/resolve', authenticate, adminController.resolveComplaintDirectly);
router.get('/partners/:id/warnings', authenticate, adminController.getPartnerWarnings);

// NEW: Partner Warning System Endpoints (3-strike rule)
router.post('/partners/:id/warn', authenticate, adminController.warnPartner);
router.post('/partners/:id/block', authenticate, adminController.blockPartner);
router.post('/partners/:id/unblock', authenticate, adminController.unblockPartner);

// NEW: Staging Queue for Category C (Specialized Dairy & Organics)
router.get('/staging-queue', authenticate, adminController.getStagingQueue);
router.post('/staging-queue/:orderId/assign', authenticate, adminController.assignStagingOrder);

module.exports = router;