const db = require('../config/db');

// GET /api/vendors?zone_id=...
async function listVendors(req, res) {
  const { zone_id } = req.query;
  if (!zone_id) return res.status(400).json({ error: 'zone_id is required' });

  const result = await db.query(
    `SELECT * FROM vendors WHERE zone_id = $1 AND is_active = true ORDER BY rating DESC`,
    [zone_id]
  );
  res.json(result.rows);
}

// GET /api/vendors/:id/products
async function getVendorProducts(req, res) {
  const { id } = req.params;
  const result = await db.query(
    `SELECT * FROM products WHERE vendor_id = $1 AND is_active = true ORDER BY category, name`,
    [id]
  );
  res.json(result.rows);
}

module.exports = { listVendors, getVendorProducts };
