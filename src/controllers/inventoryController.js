const db = require('../config/db');

// GET /api/inventory - Get all inventory items
async function getInventory(req, res) {
  try {
    const result = await db.query(
      `SELECT * FROM inventory ORDER BY category, name`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching inventory:', error);
    res.status(500).json({ error: 'Failed to fetch inventory' });
  }
}

// GET /api/inventory/low-stock - Get low stock items
async function getLowStockItems(req, res) {
  try {
    const result = await db.query(
      `SELECT * FROM inventory WHERE stock_quantity <= reorder_level ORDER BY stock_quantity ASC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching low stock items:', error);
    res.status(500).json({ error: 'Failed to fetch low stock items' });
  }
}

// POST /api/inventory - Add new inventory item
async function addInventoryItem(req, res) {
  try {
    const { product_id, category, name, stock_quantity, unit, reorder_level } = req.body;

    if (!category || !name || !stock_quantity || !unit) {
      return res.status(400).json({ error: 'Category, name, stock quantity, and unit are required' });
    }

    const result = await db.query(
      `INSERT INTO inventory (product_id, category, name, stock_quantity, unit, reorder_level)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [product_id || null, category, name, stock_quantity, unit, reorder_level || 10]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error adding inventory item:', error);
    res.status(500).json({ error: 'Failed to add inventory item' });
  }
}

// PATCH /api/inventory/:id - Update inventory item
async function updateInventoryItem(req, res) {
  try {
    const { id } = req.params;
    const { stock_quantity, reorder_level } = req.body;

    const result = await db.query(
      `UPDATE inventory 
       SET stock_quantity = COALESCE($1, stock_quantity),
           reorder_level = COALESCE($2, reorder_level),
           updated_at = now()
       WHERE id = $3
       RETURNING *`,
      [stock_quantity, reorder_level, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Inventory item not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating inventory item:', error);
    res.status(500).json({ error: 'Failed to update inventory item' });
  }
}

// DELETE /api/inventory/:id - Delete inventory item
async function deleteInventoryItem(req, res) {
  try {
    const { id } = req.params;

    const result = await db.query(
      `DELETE FROM inventory WHERE id = $1 RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Inventory item not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting inventory item:', error);
    res.status(500).json({ error: 'Failed to delete inventory item' });
  }
}

module.exports = {
  getInventory,
  getLowStockItems,
  addInventoryItem,
  updateInventoryItem,
  deleteInventoryItem
};