const db = require('../config/db');

// POST /api/addresses
// Body: { zone_id, label, line1, line2, city, pincode, is_default }
async function createAddress(req, res) {
  const userId = req.userId;
  const { zone_id, label, line1, line2, city, pincode, is_default } = req.body;

  if (!zone_id || !line1) return res.status(400).json({ error: 'zone_id and line1 are required' });

  const result = await db.query(
    `INSERT INTO addresses (user_id, zone_id, label, line1, line2, city, pincode, is_default)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [userId, zone_id, label || null, line1, line2 || null, city || null, pincode || null, !!is_default]
  );

  res.status(201).json(result.rows[0]);
}

// GET /api/addresses
async function listAddresses(req, res) {
  const userId = req.userId;
  const result = await db.query('SELECT * FROM addresses WHERE user_id = $1 ORDER BY is_default DESC, created_at DESC', [userId]);
  res.json(result.rows);
}

module.exports = { createAddress, listAddresses };
