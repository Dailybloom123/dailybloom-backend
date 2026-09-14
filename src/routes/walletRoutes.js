const express = require('express');
const router = express.Router();
const {
  getWalletBalance,
  getTransactionHistory,
  getTransaction,
  adjustWalletBalance,
  debitWallet,
  creditWallet
} = require('../controllers/walletController');
const { authenticate } = require('../middleware/auth');

// Customer routes
router.get('/balance', authenticate, getWalletBalance);
router.get('/transactions', authenticate, getTransactionHistory);
router.get('/transactions/:transactionId', authenticate, getTransaction);
router.post('/debit', authenticate, debitWallet);
router.post('/credit', authenticate, creditWallet);

// Admin-only routes
router.post('/admin/adjust', authenticate, adjustWalletBalance);

module.exports = router;
