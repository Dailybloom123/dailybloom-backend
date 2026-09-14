const db = require('../config/db');

// POST /api/addresses
// Body: { title, ordering_for, recipient_name, recipient_phone, address_type, custom_address_type, line1, flat_house_number, street_building_society, locality, city, pincode, landmark, latitude, longitude, is_default }
async function createAddress(req, res) {
  const userId = req.user.userId;
  const { 
    title, 
    ordering_for, 
    recipient_name, 
    recipient_phone, 
    address_type, 
    custom_address_type, 
    line1, 
    flat_house_number, 
    street_building_society, 
    locality, 
    city, 
    pincode, 
    landmark, 
    latitude, 
    longitude, 
    is_default 
  } = req.body;

  if (!line1 || !locality || !pincode) {
    return res.status(400).json({ error: 'line1, locality, and pincode are required' });
  }

  // If this new address is being set as default, unset any existing default first
  if (is_default) {
    await db.query('UPDATE addresses SET is_default = false WHERE user_id = $1', [userId]);
  }

  const result = await db.query(
    `INSERT INTO addresses (user_id, title, ordering_for, recipient_name, recipient_phone, address_type, custom_address_type, line1, flat_house_number, street_building_society, locality, city, pincode, landmark, latitude, longitude, is_default)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) RETURNING *`,
    [userId, title, ordering_for, recipient_name, recipient_phone, address_type, custom_address_type, line1, flat_house_number, street_building_society, locality, city || 'Guwahati', pincode, landmark, latitude, longitude, !!is_default]
  );

  res.status(201).json({ address: result.rows[0] });
}

// GET /api/addresses
async function listAddresses(req, res) {
  const userId = req.user.userId;
  const result = await db.query('SELECT * FROM addresses WHERE user_id = $1 ORDER BY is_default DESC, created_at DESC', [userId]);
  res.json({ addresses: result.rows });
}

// PATCH /api/addresses/:id/default
// Marks this address as the default, unsetting any other default for this user.
async function setDefaultAddress(req, res) {
  const userId = req.user.userId;
  const { id } = req.params;

  const check = await db.query('SELECT id FROM addresses WHERE id = $1 AND user_id = $2', [id, userId]);
  if (check.rows.length === 0) return res.status(404).json({ error: 'Address not found' });

  await db.query('UPDATE addresses SET is_default = false WHERE user_id = $1', [userId]);
  const result = await db.query('UPDATE addresses SET is_default = true WHERE id = $1 RETURNING *', [id]);
  res.json(result.rows[0]);
}

// DELETE /api/addresses/:id
async function deleteAddress(req, res) {
  const userId = req.user.userId;
  const { id } = req.params;

  // Soft delete - mark as deleted instead of removing from database
  const result = await db.query('UPDATE addresses SET is_deleted = true WHERE id = $1 AND user_id = $2 RETURNING *', [id, userId]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'Address not found' });
  res.json({ deleted: true });
}

// GET /api/addresses/archived
async function listArchivedAddresses(req, res) {
  const userId = req.user.userId;
  const result = await db.query('SELECT * FROM addresses WHERE user_id = $1 AND is_deleted = true ORDER BY created_at DESC', [userId]);
  res.json(result.rows);
}

// POST /api/addresses/:id/restore
async function restoreAddress(req, res) {
  const userId = req.user.userId;
  const { id } = req.params;

  const result = await db.query('UPDATE addresses SET is_deleted = false WHERE id = $1 AND user_id = $2 RETURNING *', [id, userId]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'Address not found' });
  res.json(result.rows[0]);
}

// DELETE /api/addresses/:id/permanent
async function permanentDeleteAddress(req, res) {
  const userId = req.user.userId;
  const { id } = req.params;

  // Hard delete - permanently remove from database
  const result = await db.query('DELETE FROM addresses WHERE id = $1 AND user_id = $2 RETURNING *', [id, userId]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'Address not found' });
  res.json({ deleted: true });
}

// PUT /api/addresses/:id
async function updateAddress(req, res) {
  const userId = req.user.userId;
  const { id } = req.params;
  const { 
    title, 
    ordering_for, 
    recipient_name, 
    recipient_phone, 
    address_type, 
    custom_address_type, 
    line1, 
    flat_house_number, 
    street_building_society, 
    locality, 
    city, 
    pincode, 
    landmark, 
    latitude, 
    longitude 
  } = req.body;

  if (!line1 || !locality || !pincode) {
    return res.status(400).json({ error: 'line1, locality, and pincode are required' });
  }

  const result = await db.query(
    `UPDATE addresses 
     SET title = $1, ordering_for = $2, recipient_name = $3, recipient_phone = $4, 
         address_type = $5, custom_address_type = $6, line1 = $7, flat_house_number = $8, 
         street_building_society = $9, locality = $10, city = $11, pincode = $12, 
         landmark = $13, latitude = $14, longitude = $15
     WHERE id = $16 AND user_id = $17
     RETURNING *`,
    [title, ordering_for, recipient_name, recipient_phone, address_type, custom_address_type, 
     line1, flat_house_number, street_building_society, locality, city || 'Guwahati', pincode, 
     landmark, latitude, longitude, id, userId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Address not found' });
  }

  res.json({ address: result.rows[0] });
}

module.exports = { createAddress, listAddresses, setDefaultAddress, deleteAddress, updateAddress, listArchivedAddresses, restoreAddress, permanentDeleteAddress };
