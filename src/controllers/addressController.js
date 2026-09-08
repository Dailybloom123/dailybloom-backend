const db = require('../config/db');

// POST /api/addresses
// Body: { zone_id, label, line1, line2, city, pincode, is_default, recipient_name, delivery_instructions, title, contact_number }
async function createAddress(req, res) {
  const userId = req.userId;
  const { zone_id, label, line1, line2, city, pincode, is_default, recipient_name, delivery_instructions, title, contact_number, latitude, longitude } = req.body;

  if (!zone_id || !line1) return res.status(400).json({ error: 'zone_id and line1 are required' });

  // If this new address is being set as default, unset any existing default first —
  // only one address should ever be marked default at a time.
  if (is_default) {
    await db.query('UPDATE addresses SET is_default = false WHERE user_id = $1', [userId]);
  }

  const result = await db.query(
    `INSERT INTO addresses (user_id, zone_id, label, line1, line2, city, pincode, is_default, recipient_name, delivery_instructions, title, contact_number, latitude, longitude)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`,
    [userId, zone_id, label || null, line1, line2 || null, city || null, pincode || null, !!is_default, recipient_name || null, delivery_instructions || null, title || null, contact_number || null, latitude || null, longitude || null]
  );

  res.status(201).json(result.rows[0]);
}

// GET /api/addresses
async function listAddresses(req, res) {
  const userId = req.userId;
  const result = await db.query('SELECT * FROM addresses WHERE user_id = $1 AND is_deleted = false ORDER BY is_default DESC, created_at DESC', [userId]);
  res.json(result.rows);
}

// PATCH /api/addresses/:id/default
// Marks this address as the default, unsetting any other default for this user.
async function setDefaultAddress(req, res) {
  const userId = req.userId;
  const { id } = req.params;

  const check = await db.query('SELECT id FROM addresses WHERE id = $1 AND user_id = $2', [id, userId]);
  if (check.rows.length === 0) return res.status(404).json({ error: 'Address not found' });

  await db.query('UPDATE addresses SET is_default = false WHERE user_id = $1', [userId]);
  const result = await db.query('UPDATE addresses SET is_default = true WHERE id = $1 RETURNING *', [id]);
  res.json(result.rows[0]);
}

// DELETE /api/addresses/:id
async function deleteAddress(req, res) {
  const userId = req.userId;
  const { id } = req.params;

  // Soft delete - mark as deleted instead of removing from database
  const result = await db.query('UPDATE addresses SET is_deleted = true WHERE id = $1 AND user_id = $2 RETURNING *', [id, userId]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'Address not found' });
  res.json({ deleted: true });
}

// GET /api/addresses/archived
async function listArchivedAddresses(req, res) {
  const userId = req.userId;
  const result = await db.query('SELECT * FROM addresses WHERE user_id = $1 AND is_deleted = true ORDER BY created_at DESC', [userId]);
  res.json(result.rows);
}

// POST /api/addresses/:id/restore
async function restoreAddress(req, res) {
  const userId = req.userId;
  const { id } = req.params;

  const result = await db.query('UPDATE addresses SET is_deleted = false WHERE id = $1 AND user_id = $2 RETURNING *', [id, userId]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'Address not found' });
  res.json(result.rows[0]);
}

// DELETE /api/addresses/:id/permanent
async function permanentDeleteAddress(req, res) {
  const userId = req.userId;
  const { id } = req.params;

  // Hard delete - permanently remove from database
  const result = await db.query('DELETE FROM addresses WHERE id = $1 AND user_id = $2 RETURNING *', [id, userId]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'Address not found' });
  res.json({ deleted: true });
}

module.exports = { createAddress, listAddresses, setDefaultAddress, deleteAddress, listArchivedAddresses, restoreAddress, permanentDeleteAddress };
