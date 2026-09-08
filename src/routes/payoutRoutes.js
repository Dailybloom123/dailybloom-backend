const express = require('express');
const router = express.Router();
const payoutController = require('../controllers/payoutController');
const { authenticateAdmin } = require('../middleware/auth');

// Partner routes
router.get('/partner/:partnerId/earnings', payoutController.getPartnerEarnings);
router.get('/partner/:partnerId/history', payoutController.getPayoutHistory);
router.put('/partner/:partnerId/bank-details', payoutController.updatePartnerBankDetails);

// Admin routes
router.get('/admin/pending', authenticateAdmin, payoutController.getPendingPayouts);
router.get('/admin/statistics', authenticateAdmin, payoutController.getPayoutStatistics);
router.post('/partner/:partnerId/request', authenticateAdmin, payoutController.createPayoutRequest);
router.put('/admin/process/:payoutRequestId', authenticateAdmin, payoutController.processPayout);

module.exports = router;