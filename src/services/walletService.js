const { Pool } = require('pg');
const pool = require('../config/db');

/**
 * Wallet Service - Handles all wallet operations with atomic transactions
 * Implements double-entry ledger architecture for audit trail
 */

class WalletService {
  /**
   * Get or create wallet for a user
   */
  static async getOrCreateWallet(userId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Try to get existing wallet
      const existingWallet = await client.query(
        'SELECT * FROM user_wallets WHERE user_id = $1',
        [userId]
      );

      if (existingWallet.rows.length > 0) {
        await client.query('COMMIT');
        return existingWallet.rows[0];
      }

      // Create new wallet
      const newWallet = await client.query(
        `INSERT INTO user_wallets (user_id, balance, currency, is_active)
         VALUES ($1, 0.00, 'INR', true)
         ON CONFLICT (user_id) DO NOTHING
         RETURNING *`,
        [userId]
      );

      await client.query('COMMIT');
      return newWallet.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get wallet balance
   */
  static async getBalance(userId) {
    const wallet = await this.getOrCreateWallet(userId);
    return {
      wallet_id: wallet.wallet_id,
      balance: parseFloat(wallet.balance),
      currency: wallet.currency,
      is_active: wallet.is_active
    };
  }

  /**
   * Credit wallet (add money)
   * @param {string} userId - User ID
   * @param {number} amount - Amount to credit
   * @param {string} type - Transaction type (CREDIT_TOPUP, CREDIT_REFUND)
   * @param {string} description - Transaction description
   * @param {object} metadata - Additional metadata
   * @param {string} referencePaymentId - Payment reference ID for idempotency
   */
  static async credit(userId, amount, type, description, metadata = {}, referencePaymentId = null) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Check for idempotency - if payment reference exists, return existing transaction
      if (referencePaymentId) {
        const existingTx = await client.query(
          'SELECT * FROM wallet_transactions WHERE reference_payment_id = $1',
          [referencePaymentId]
        );
        if (existingTx.rows.length > 0) {
          await client.query('COMMIT');
          return existingTx.rows[0];
        }
      }

      // Get wallet with row lock
      const wallet = await client.query(
        'SELECT * FROM user_wallets WHERE user_id = $1 FOR UPDATE',
        [userId]
      );

      if (wallet.rows.length === 0) {
        throw new Error('Wallet not found');
      }

      const walletData = wallet.rows[0];
      const newBalance = parseFloat(walletData.balance) + parseFloat(amount);

      // Update wallet balance
      await client.query(
        'UPDATE user_wallets SET balance = $1, updated_at = NOW() WHERE wallet_id = $2',
        [newBalance, walletData.wallet_id]
      );

      // Create transaction record
      const transaction = await client.query(
        `INSERT INTO wallet_transactions
         (wallet_id, amount, type, status, balance_after, description, metadata, reference_payment_id)
         VALUES ($1, $2, $3, 'SUCCESS', $4, $5, $6, $7)
         RETURNING *`,
        [walletData.wallet_id, amount, type, newBalance, description, JSON.stringify(metadata), referencePaymentId]
      );

      await client.query('COMMIT');
      return transaction.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Debit wallet (deduct money)
   * @param {string} userId - User ID
   * @param {number} amount - Amount to debit
   * @param {string} type - Transaction type (DEBIT_ORDER, DEBIT_ADJUSTMENT)
   * @param {string} description - Transaction description
   * @param {object} metadata - Additional metadata
   * @param {string} referenceOrderId - Order reference ID
   */
  static async debit(userId, amount, type, description, metadata = {}, referenceOrderId = null) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Get wallet with row lock
      const wallet = await client.query(
        'SELECT * FROM user_wallets WHERE user_id = $1 FOR UPDATE',
        [userId]
      );

      if (wallet.rows.length === 0) {
        throw new Error('Wallet not found');
      }

      const walletData = wallet.rows[0];
      const currentBalance = parseFloat(walletData.balance);

      // Check sufficient balance
      if (currentBalance < parseFloat(amount)) {
        // Create failed transaction record
        await client.query(
          `INSERT INTO wallet_transactions
           (wallet_id, amount, type, status, balance_after, description, metadata, reference_order_id)
           VALUES ($1, $2, $3, 'FAILED', $4, $5, $6, $7)`,
          [walletData.wallet_id, amount, type, currentBalance, description, JSON.stringify(metadata), referenceOrderId]
        );
        await client.query('COMMIT');
        throw new Error('Insufficient wallet balance');
      }

      const newBalance = currentBalance - parseFloat(amount);

      // Update wallet balance
      await client.query(
        'UPDATE user_wallets SET balance = $1, updated_at = NOW() WHERE wallet_id = $2',
        [newBalance, walletData.wallet_id]
      );

      // Create transaction record
      const transaction = await client.query(
        `INSERT INTO wallet_transactions
         (wallet_id, amount, type, status, balance_after, description, metadata, reference_order_id)
         VALUES ($1, $2, $3, 'SUCCESS', $4, $5, $6, $7)
         RETURNING *`,
        [walletData.wallet_id, amount, type, newBalance, description, JSON.stringify(metadata), referenceOrderId]
      );

      await client.query('COMMIT');
      return transaction.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get transaction history for a wallet
   */
  static async getTransactionHistory(userId, limit = 50, offset = 0) {
    const wallet = await this.getOrCreateWallet(userId);

    const transactions = await pool.query(
      `SELECT * FROM wallet_transactions
       WHERE wallet_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [wallet.wallet_id, limit, offset]
    );

    return transactions.rows;
  }

  /**
   * Get transaction by ID
   */
  static async getTransaction(transactionId) {
    const transaction = await pool.query(
      'SELECT * FROM wallet_transactions WHERE transaction_id = $1',
      [transactionId]
    );

    if (transaction.rows.length === 0) {
      throw new Error('Transaction not found');
    }

    return transaction.rows[0];
  }

  /**
   * Refund order to wallet
   */
  static async refundOrder(userId, orderId, amount, description = 'Order refund') {
    return this.credit(
      userId,
      amount,
      'CREDIT_REFUND',
      description,
      { order_id: orderId },
      null
    );
  }

  /**
   * Adjust wallet balance (admin operation)
   */
  static async adjustBalance(userId, amount, description = 'Balance adjustment') {
    if (amount > 0) {
      return this.credit(userId, amount, 'DEBIT_ADJUSTMENT', description);
    } else {
      return this.debit(userId, Math.abs(amount), 'DEBIT_ADJUSTMENT', description);
    }
  }
}

module.exports = WalletService;
