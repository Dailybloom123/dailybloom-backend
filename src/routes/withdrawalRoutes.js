const express = require('express');
const router = express.Router();
const {
  createWithdrawalRequest,
  getUserWithdrawals,
  getAllWithdrawals,
  processWithdrawal
} = require('../controllers/withdrawalController');
const { authenticate } = require('../middleware/auth');

// Customer routes
router.post('/', authenticate, createWithdrawalRequest);
router.get('/my-withdrawals', authenticate, getUserWithdrawals);

// Admin routes
router.get('/admin/all', authenticate, getAllWithdrawals);
router.patch('/admin/:requestId/process', authenticate, processWithdrawal);

module.exports = router;
