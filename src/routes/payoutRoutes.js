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
const { requireAdmin } = require('../middleware/auth');

// Partner routes
router.get('/partner/:partnerId/earnings', getPartnerEarnings);
router.get('/partner/:partnerId/history', getPayoutHistory);
router.put('/partner/:partnerId/bank-details', updatePartnerBankDetails);

// Admin routes
router.get('/admin/pending', requireAdmin, getPendingPayouts);
router.get('/admin/statistics', requireAdmin, getPayoutStatistics);
router.post('/partner/:partnerId/request', requireAdmin, createPayoutRequest);
router.put('/admin/process/:payoutRequestId', requireAdmin, processPayout);

module.exports = router;