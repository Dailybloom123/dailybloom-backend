const WalletService = require('../services/walletService');
const { asyncHandler, AuthenticationError, ValidationError } = require('../middleware/errorHandler');

/**
 * Wallet Controller - Handles wallet-related API endpoints
 */

// Get wallet balance
const getWalletBalance = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const balance = await WalletService.getBalance(userId);

  res.json({
    success: true,
    wallet: balance
  });
});

// Get transaction history
const getTransactionHistory = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const limit = parseInt(req.query.limit) || 50;
  const offset = parseInt(req.query.offset) || 0;

  const transactions = await WalletService.getTransactionHistory(userId, limit, offset);

  res.json({
    success: true,
    transactions,
    count: transactions.length
  });
});

// Get single transaction details
const getTransaction = asyncHandler(async (req, res) => {
  const { transactionId } = req.params;
  const userId = req.user.userId;

  const transaction = await WalletService.getTransaction(transactionId);

  // Verify user owns this transaction
  const wallet = await WalletService.getOrCreateWallet(userId);
  if (transaction.wallet_id !== wallet.wallet_id) {
    throw new AuthenticationError('You do not have access to this transaction');
  }

  res.json({
    success: true,
    transaction
  });
});

// Admin-only: Adjust wallet balance
const adjustWalletBalance = asyncHandler(async (req, res) => {
  const { userId, amount, description } = req.body;

  if (!userId || amount === undefined) {
    throw new ValidationError('User ID and amount are required');
  }

  const adjustmentAmount = parseFloat(amount);
  if (isNaN(adjustmentAmount)) {
    throw new ValidationError('Invalid amount');
  }

  const transaction = await WalletService.adjustBalance(
    userId,
    adjustmentAmount,
    description || 'Admin balance adjustment'
  );

  res.json({
    success: true,
    transaction,
    message: 'Wallet balance adjusted successfully'
  });
});

// Debit wallet (for order payments)
const debitWallet = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const { amount, type, description, reference_order_id } = req.body;

  if (!amount || !type) {
    throw new ValidationError('Amount and type are required');
  }

  const transaction = await WalletService.debit(
    userId,
    amount,
    type,
    description || 'Wallet debit',
    {},
    reference_order_id
  );

  res.json({
    success: true,
    transaction,
    message: 'Wallet debited successfully'
  });
});

// Credit wallet (for refunds or top-ups)
const creditWallet = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const { amount, type, description, reference_payment_id } = req.body;

  if (!amount || !type) {
    throw new ValidationError('Amount and type are required');
  }

  const transaction = await WalletService.credit(
    userId,
    amount,
    type,
    description || 'Wallet credit',
    {},
    reference_payment_id
  );

  res.json({
    success: true,
    transaction,
    message: 'Wallet credited successfully'
  });
});

module.exports = {
  getWalletBalance,
  getTransactionHistory,
  getTransaction,
  adjustWalletBalance,
  debitWallet,
  creditWallet
};
