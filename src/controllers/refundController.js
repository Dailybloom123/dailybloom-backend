const db = require('../config/db');

// POST /api/refunds
// Create a refund request for a cancelled order
async function createRefund(req, res) {
  const userId = req.userId;
  const { order_id, reason } = req.body;

  if (!order_id) {
    return res.status(400).json({ error: 'order_id is required' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Get the order and verify it belongs to the user
    const orderResult = await client.query(
      'SELECT * FROM orders WHERE id = $1 AND user_id = $2',
      [order_id, userId]
    );
    if (orderResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Order not found' });
    }
    const order = orderResult.rows[0];

    // Check if order is cancelled
    if (order.status !== 'cancelled') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Refunds can only be requested for cancelled orders' });
    }

    // Check if refund already exists
    const existingRefund = await client.query(
      'SELECT * FROM refunds WHERE order_id = $1',
      [order_id]
    );
    if (existingRefund.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Refund already requested for this order' });
    }

    // Create refund request
    const refundResult = await client.query(
      `INSERT INTO refunds (order_id, user_id, amount, reason, status)
       VALUES ($1, $2, $3, $4, 'pending')
       RETURNING *`,
      [order_id, userId, order.total, reason || 'Order cancelled']
    );

    await client.query('COMMIT');
    res.status(201).json(refundResult.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    const status = err.status || 500;
    res.status(status).json({ error: err.message || 'Failed to create refund request' });
  } finally {
    client.release();
  }
}

// GET /api/refunds
// Get all refunds for the logged-in user
async function getUserRefunds(req, res) {
  const userId = req.userId;

  const result = await db.query(
    `SELECT r.*, o.status as order_status FROM refunds r
     JOIN orders o ON r.order_id = o.id
     WHERE r.user_id = $1
     ORDER BY r.created_at DESC`,
    [userId]
  );

  res.json(result.rows);
}

// GET /api/admin/refunds
// Admin endpoint to get all refund requests
async function getAllRefunds(req, res) {
  const result = await db.query(
    `SELECT r.*, o.status as order_status, u.name as customer_name, u.phone as customer_phone
     FROM refunds r
     JOIN orders o ON r.order_id = o.id
     JOIN users u ON r.user_id = u.id
     ORDER BY r.created_at DESC`
  );

  res.json(result.rows);
}

// PUT /api/admin/refunds/:id/approve
// Admin endpoint to approve a refund
async function approveRefund(req, res) {
  const { id } = req.params;

  try {
    // Get refund details
    const refundResult = await db.query(
      'SELECT * FROM refunds WHERE id = $1',
      [id]
    );
    if (refundResult.rows.length === 0) {
      return res.status(404).json({ error: 'Refund not found' });
    }
    const refund = refundResult.rows[0];

    if (refund.status !== 'pending') {
      return res.status(400).json({ error: 'Refund is not in pending status' });
    }

    // Here you would integrate with Razorpay to process the actual refund
    // For now, we'll just mark it as approved
    const result = await db.query(
      `UPDATE refunds 
       SET status = 'approved', updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    // TODO: Integrate with Razorpay refund API
    // const razorpayRefund = await razorpay.payments.refund(refund.razorpay_payment_id, {
    //   amount: refund.amount * 100,
    //   notes: { refund_id: refund.id }
    // });

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to approve refund' });
  }
}

// PUT /api/admin/refunds/:id/reject
// Admin endpoint to reject a refund
async function rejectRefund(req, res) {
  const { id } = req.params;
  const { rejection_reason } = req.body;

  try {
    const result = await db.query(
      `UPDATE refunds 
       SET status = 'rejected', rejection_reason = $1, updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [rejection_reason || 'Refund rejected by admin', id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Refund not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to reject refund' });
  }
}

module.exports = { createRefund, getUserRefunds, getAllRefunds, approveRefund, rejectRefund };
