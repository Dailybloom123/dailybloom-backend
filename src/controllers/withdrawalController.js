const db = require('../config/db');
const WalletService = require('../services/walletService');
const { asyncHandler, ValidationError, AuthenticationError } = require('../middleware/errorHandler');

/**
 * Withdrawal Controller - Handles wallet withdrawal to bank account
 */

// Create withdrawal request
const createWithdrawalRequest = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { amount, bank_account_name, bank_account_number, bank_ifsc_code, bank_name } = req.body;

  if (!amount || !bank_account_name || !bank_account_number || !bank_ifsc_code) {
    throw new ValidationError('Amount, bank account name, account number, and IFSC code are required');
  }

  const withdrawalAmount = parseFloat(amount);
  if (isNaN(withdrawalAmount) || withdrawalAmount <= 0) {
    throw new ValidationError('Invalid withdrawal amount');
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Get wallet balance
    const wallet = await client.query(
      'SELECT * FROM user_wallets WHERE user_id = $1 FOR UPDATE',
      [userId]
    );

    if (wallet.rows.length === 0) {
      throw new ValidationError('Wallet not found');
    }

    const walletData = wallet.rows[0];
    const currentBalance = parseFloat(walletData.balance);

    // Check sufficient balance
    if (currentBalance < withdrawalAmount) {
      throw new ValidationError('Insufficient wallet balance');
    }

    // Create withdrawal request
    const withdrawalResult = await client.query(
      `INSERT INTO withdrawal_requests
       (user_id, wallet_id, amount, bank_account_name, bank_account_number, bank_ifsc_code, bank_name, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING')
       RETURNING *`,
      [userId, walletData.wallet_id, withdrawalAmount, bank_account_name, bank_account_number, bank_ifsc_code, bank_name || null]
    );

    // Mark funds as reserved (optional - could also debit immediately)
    // For now, we'll create a pending debit transaction
    const transactionResult = await client.query(
      `INSERT INTO wallet_transactions
       (wallet_id, amount, type, status, balance_after, description, metadata)
       VALUES ($1, $2, 'DEBIT_WITHDRAWAL', 'PROCESSING', $3, $4, $5)
       RETURNING *`,
      [walletData.wallet_id, withdrawalAmount, currentBalance - withdrawalAmount, `Withdrawal to ${bank_account_name}`, JSON.stringify({ withdrawal_request_id: withdrawalResult.rows[0].request_id })]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      withdrawal_request: withdrawalResult.rows[0],
      transaction: transactionResult.rows[0],
      message: 'Withdrawal request submitted successfully'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
});

// Get user's withdrawal requests
const getUserWithdrawals = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const result = await db.query(
    `SELECT * FROM withdrawal_requests
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId]
  );

  res.json({
    success: true,
    withdrawals: result.rows
  });
});

// Admin: Get all withdrawal requests
const getAllWithdrawals = asyncHandler(async (req, res) => {
  const { status } = req.query;

  let query = `
    SELECT wr.*, u.name as user_name, u.email as user_email
    FROM withdrawal_requests wr
    JOIN users u ON u.id = wr.user_id
  `;
  const params = [];

  if (status) {
    query += ' WHERE wr.status = $1';
    params.push(status);
  }

  query += ' ORDER BY wr.created_at DESC';

  const result = await db.query(query, params);

  res.json({
    success: true,
    withdrawals: result.rows
  });
});

// Admin: Process withdrawal request
const processWithdrawal = asyncHandler(async (req, res) => {
  const { requestId } = req.params;
  const { status, rejection_reason } = req.body;

  if (!['APPROVED', 'REJECTED', 'COMPLETED'].includes(status)) {
    throw new ValidationError('Invalid status');
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Get withdrawal request
    const withdrawal = await client.query(
      'SELECT * FROM withdrawal_requests WHERE request_id = $1 FOR UPDATE',
      [requestId]
    );

    if (withdrawal.rows.length === 0) {
      throw new ValidationError('Withdrawal request not found');
    }

    const withdrawalData = withdrawal.rows[0];

    if (withdrawalData.status !== 'PENDING') {
      throw new ValidationError('Withdrawal request already processed');
    }

    if (status === 'REJECTED') {
      // Reject: return funds to wallet
      await client.query(
        `UPDATE withdrawal_requests
         SET status = 'REJECTED', rejection_reason = $1, processed_at = NOW(), updated_at = NOW()
         WHERE request_id = $2`,
        [rejection_reason || null, requestId]
      );

      // Credit back to wallet
      const walletResult = await client.query(
        'SELECT * FROM user_wallets WHERE wallet_id = $1 FOR UPDATE',
        [withdrawalData.wallet_id]
      );

      const wallet = walletResult.rows[0];
      const newBalance = parseFloat(wallet.balance) + parseFloat(withdrawalData.amount);

      await client.query(
        'UPDATE user_wallets SET balance = $1, updated_at = NOW() WHERE wallet_id = $2',
        [newBalance, withdrawalData.wallet_id]
      );

      await client.query(
        `INSERT INTO wallet_transactions
         (wallet_id, amount, type, status, balance_after, description, metadata)
         VALUES ($1, $2, 'CREDIT_REFUND', 'SUCCESS', $3, $4, $5)`,
        [withdrawalData.wallet_id, withdrawalData.amount, newBalance, 'Withdrawal rejected - funds returned', JSON.stringify({ withdrawal_request_id: requestId })]
      );
    } else if (status === 'APPROVED') {
      // Approve: mark as approved
      await client.query(
        `UPDATE withdrawal_requests
         SET status = 'APPROVED', processed_at = NOW(), updated_at = NOW()
         WHERE request_id = $1`,
        [requestId]
      );
    } else if (status === 'COMPLETED') {
      // Complete: finalize the withdrawal
      const walletResult = await client.query(
        'SELECT * FROM user_wallets WHERE wallet_id = $1 FOR UPDATE',
        [withdrawalData.wallet_id]
      );

      const wallet = walletResult.rows[0];
      const currentBalance = parseFloat(wallet.balance);

      if (currentBalance < withdrawalData.amount) {
        throw new ValidationError('Insufficient wallet balance to complete withdrawal');
      }

      const newBalance = currentBalance - parseFloat(withdrawalData.amount);

      await client.query(
        'UPDATE user_wallets SET balance = $1, updated_at = NOW() WHERE wallet_id = $2',
        [newBalance, withdrawalData.wallet_id]
      );

      await client.query(
        `UPDATE withdrawal_requests
         SET status = 'COMPLETED', processed_at = NOW(), updated_at = NOW()
         WHERE request_id = $1`,
        [requestId]
      );

      await client.query(
        `UPDATE wallet_transactions
         SET status = 'SUCCESS', balance_after = $1
         WHERE wallet_id = $2 AND metadata->>'withdrawal_request_id' = $3`,
        [newBalance, withdrawalData.wallet_id, requestId]
      );
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      message: `Withdrawal request ${status.toLowerCase()} successfully`
    });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
});

module.exports = {
  createWithdrawalRequest,
  getUserWithdrawals,
  getAllWithdrawals,
  processWithdrawal
};
