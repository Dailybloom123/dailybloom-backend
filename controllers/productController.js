const db = require('../config/db');

// GET /api/products?zone_id=...&category=...
// Browsing is always scoped to a delivery zone, since only vendors in that
// zone can actually deliver to the customer.
async function listProducts(req, res) {
  const { zone_id, category } = req.query;
  if (!zone_id) return res.status(400).json({ error: 'zone_id is required' });

  const conditions = ['v.zone_id = $1', 'p.is_active = true', 'v.is_active = true'];
  const params = [zone_id];

  if (category) {
    params.push(category);
    conditions.push(`p.category = $${params.length}`);
  }

  const result = await db.query(
    `SELECT p.*, v.name AS vendor_name, v.rating AS vendor_rating
     FROM products p
     JOIN vendors v ON v.id = p.vendor_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY p.category, p.name`,
    params
  );

  res.json(result.rows);
}

// GET /api/products/:id
async function getProduct(req, res) {
  const { id } = req.params;
  const result = await db.query(
    `SELECT p.*, v.name AS vendor_name, v.rating AS vendor_rating
     FROM products p JOIN vendors v ON v.id = p.vendor_id
     WHERE p.id = $1`,
    [id]
  );

  if (result.rows.length === 0) return res.status(404).json({ error: 'Product not found' });
  res.json(result.rows[0]);
}

module.exports = { listProducts, getProduct };
