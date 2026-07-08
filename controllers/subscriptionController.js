const db = require('../config/db');

// POST /api/subscriptions
// Body: { product_id, address_id, frequency, quantity }
async function createSubscription(req, res) {
  const userId = req.userId;
  const { product_id, address_id, frequency, quantity } = req.body;

  if (!product_id || !address_id) {
    return res.status(400).json({ error: 'product_id and address_id are required' });
  }

  // Only products marked subscribable can be turned into a subscription
  const productResult = await db.query('SELECT * FROM products WHERE id = $1 AND subscribable = true', [product_id]);
  if (productResult.rows.length === 0) {
    return res.status(400).json({ error: 'This product is not available for subscription' });
  }

  const result = await db.query(
    `INSERT INTO subscriptions (user_id, product_id, address_id, frequency, quantity, status)
     VALUES ($1, $2, $3, $4, $5, 'active') RETURNING *`,
    [userId, product_id, address_id, frequency || 'daily', quantity || 1]
  );

  res.status(201).json(result.rows[0]);
}

// GET /api/subscriptions
async function listSubscriptions(req, res) {
  const userId = req.userId;
  const result = await db.query(
    `SELECT s.*, p.name AS product_name, p.price, p.unit
     FROM subscriptions s JOIN products p ON p.id = s.product_id
     WHERE s.user_id = $1 ORDER BY s.created_at DESC`,
    [userId]
  );
  res.json(result.rows);
}

// PATCH /api/subscriptions/:id
// Body: { status?, quantity?, paused_until? }
// Used for pausing, resuming, cancelling, or adjusting quantity.
async function updateSubscription(req, res) {
  const userId = req.userId;
  const { id } = req.params;
  const { status, quantity, paused_until } = req.body;

  const existing = await db.query('SELECT * FROM subscriptions WHERE id = $1 AND user_id = $2', [id, userId]);
  if (existing.rows.length === 0) return res.status(404).json({ error: 'Subscription not found' });

  const result = await db.query(
    `UPDATE subscriptions
     SET status = COALESCE($1, status),
         quantity = COALESCE($2, quantity),
         paused_until = COALESCE($3, paused_until),
         updated_at = now()
     WHERE id = $4 RETURNING *`,
    [status || null, quantity || null, paused_until || null, id]
  );

  res.json(result.rows[0]);
}

module.exports = { createSubscription, listSubscriptions, updateSubscription };
