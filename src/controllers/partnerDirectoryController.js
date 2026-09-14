const db = require('../config/db');
const { asyncHandler, ValidationError } = require('../middleware/errorHandler');

/**
 * Partner Directory Controller - Public partner transparency
 */

// Get all public partners for directory
const getPublicPartners = asyncHandler(async (req, res) => {
  const { locality, specialty } = req.query;

  let query = `
    SELECT id, business_name, slug, bio, locality, fssai_number,
           fssai_verified, specialty_tags, partner_type, created_at
    FROM users
    WHERE role = 'vendor'
      AND is_public = true
  `;

  const params = [];
  const conditions = [];

  if (locality) {
    conditions.push(`locality ILIKE $${params.length + 1}`);
    params.push(`%${locality}%`);
  }

  if (specialty) {
    conditions.push(`$${params.length + 1} = ANY(specialty_tags)`);
    params.push(specialty);
  }

  if (conditions.length > 0) {
    query += ' AND ' + conditions.join(' AND ');
  }

  query += ' ORDER BY business_name ASC';

  const result = await db.query(query, params);

  res.json({
    success: true,
    partners: result.rows
  });
});

// Get single partner by slug
const getPartnerBySlug = asyncHandler(async (req, res) => {
  const { slug } = req.params;

  const result = await db.query(
    `SELECT id, business_name, slug, bio, locality, fssai_number,
            fssai_verified, specialty_tags, partner_type, created_at
     FROM users
     WHERE role = 'vendor'
       AND is_public = true
       AND slug = $1`,
    [slug]
  );

  if (result.rows.length === 0) {
    throw new ValidationError('Partner not found');
  }

  // Get partner's products
  const products = await db.query(
    `SELECT id, name, category, price, unit, image, description
     FROM products
     WHERE partner_id = $1
       AND is_active = true
     ORDER BY name ASC`,
    [result.rows[0].id]
  );

  res.json({
    success: true,
    partner: result.rows[0],
    products: products.rows
  });
});

// Get partner's products
const getPartnerProducts = asyncHandler(async (req, res) => {
  const { partnerId } = req.params;

  const result = await db.query(
    `SELECT id, name, category, price, unit, image, description, stock
     FROM products
     WHERE partner_id = $1
       AND is_active = true
     ORDER BY name ASC`,
    [partnerId]
  );

  res.json({
    success: true,
    products: result.rows
  });
});

module.exports = {
  getPublicPartners,
  getPartnerBySlug,
  getPartnerProducts
};
