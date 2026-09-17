const db = require('../config/db');
const { get, set, delPattern } = require('../config/redis');

// GET /api/products?zone_id=...&category=...
// Browsing is always scoped to a delivery zone, since only vendors in that
// zone can actually deliver to the customer.
// If no zone_id is provided, return all active products (for catalog browsing)
async function listProducts(req, res) {
  const { zone_id, category } = req.query;

  // Try to get from cache first (skip if Redis not configured)
  const cacheKey = `products:${zone_id || 'all'}:${category || 'all'}`;
  try {
    const cached = await get(cacheKey);
    if (cached) {
      return res.json(cached);
    }
  } catch (error) {
    console.error('Cache error:', error);
    // Continue without cache
  }

  const conditions = ['p.is_active = true', 'v.is_active = true'];
  const params = [];

  let paramCount = 0;

  if (zone_id) {
    paramCount++;
    params.push(zone_id);
    conditions.push(`v.zone_id = $${paramCount}`);
  }

  if (category) {
    paramCount++;
    params.push(category);
    conditions.push(`p.category = $${paramCount}`);
  }

  const result = await db.query(
    `SELECT p.*, v.name AS vendor_name, v.rating AS vendor_rating
     FROM products p
     JOIN vendors v ON v.id = p.vendor_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY p.category, p.name`,
    params
  );

  // Cache the result for 5 minutes (skip if Redis not configured)
  try {
    await set(cacheKey, result.rows, 300);
  } catch (error) {
    console.error('Cache set error:', error);
    // Continue without caching
  }

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

// PUT /api/admin/products/:id/stock
// Admin endpoint to update product stock
async function updateProductStock(req, res) {
  const { id } = req.params;
  const { stock, out_of_stock } = req.body;

  if (stock === undefined && out_of_stock === undefined) {
    return res.status(400).json({ error: 'stock or out_of_stock is required' });
  }

  try {
    const updates = [];
    const params = [];
    let paramCount = 0;

    if (stock !== undefined) {
      paramCount++;
      updates.push(`stock = $${paramCount}`);
      params.push(stock);
    }

    if (out_of_stock !== undefined) {
      paramCount++;
      updates.push(`is_active = $${paramCount}`);
      params.push(!out_of_stock);
    }

    paramCount++;
    params.push(id);

    const result = await db.query(
      `UPDATE products SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Invalidate all product caches since stock changed
    const { delPattern } = require('../config/redis');
    await delPattern('products:*');

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating product stock:', err);
    res.status(500).json({ error: 'Failed to update product stock' });
  }
}

// GET /api/admin/products/low-stock
// Admin endpoint to get products with low stock
async function getLowStockProducts(req, res) {
  const threshold = parseInt(req.query.threshold) || 10;

  const result = await db.query(
    `SELECT p.*, v.name AS vendor_name
     FROM products p
     JOIN vendors v ON v.id = p.vendor_id
     WHERE p.stock <= $1 AND p.is_active = true
     ORDER BY p.stock ASC`,
    [threshold]
  );

  res.json(result.rows);
}

module.exports = { listProducts, getProduct, updateProductStock, getLowStockProducts };
