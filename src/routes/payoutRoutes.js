const express = require('express');
const router = express.Router();
const { 
  getPartnerEarnings,
  getPayoutHistory,
  updatePartnerBankDetails,
  getPendingPayouts,
  getPayoutStatistics,
  createPayoutRequest,
  processPayout
} = require('../controllers/payoutController');
const { authenticateAdmin } = require('../middleware/auth');

// Partner routes
router.get('/partner/:partnerId/earnings', getPartnerEarnings);
router.get('/partner/:partnerId/history', getPayoutHistory);
router.put('/partner/:partnerId/bank-details', updatePartnerBankDetails);

// Admin routes
router.get('/admin/pending', authenticateAdmin, getPendingPayouts);
router.get('/admin/statistics', authenticateAdmin, getPayoutStatistics);
router.post('/partner/:partnerId/request', authenticateAdmin, createPayoutRequest);
router.put('/admin/process/:payoutRequestId', authenticateAdmin, processPayout);

module.exports = router;