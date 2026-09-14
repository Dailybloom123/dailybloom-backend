const db = require('../config/db');

// Get all stock notifications for admin
const getStockNotifications = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT sn.*, p.name as partner_name, p.category 
       FROM stock_notifications sn 
       JOIN partners p ON sn.partner_id = p.id 
       ORDER BY sn.created_at DESC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching stock notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
};

// Create stock notification from partner
const createStockNotification = async (req, res) => {
  try {
    const { type, message, product_id, quantity } = req.body;
    const partner_id = req.user.userId; // Get from JWT token
    
    const result = await db.query(
      `INSERT INTO stock_notifications (partner_id, type, message, product_id, quantity, status)
       VALUES ($1::uuid, $2, $3, $4::uuid, $5, 'pending')
       RETURNING *`,
      [partner_id, type, message, product_id, quantity]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating stock notification:', error);
    res.status(500).json({ error: 'Failed to create notification' });
  }
};

// Update stock notification status (admin action)
const updateStockNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, admin_response } = req.body;
    
    const result = await db.query(
      `UPDATE stock_notifications 
       SET status = $1, admin_response = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [status, admin_response, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating stock notification:', error);
    res.status(500).json({ error: 'Failed to update notification' });
  }
};

// Get partner's stock notifications
const getPartnerStockNotifications = async (req, res) => {
  try {
    const partner_id = req.user.userId; // Get from JWT token
    
    const result = await db.query(
      `SELECT * FROM stock_notifications 
       WHERE partner_id = $1::uuid 
       ORDER BY created_at DESC`,
      [partner_id]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching partner stock notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
};

// Get low stock alerts for admin
const getLowStockAlerts = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM products 
       WHERE stock <= reorder_level 
       ORDER BY stock ASC`
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching low stock alerts:', error);
    res.status(500).json({ error: 'Failed to fetch low stock alerts' });
  }
};

module.exports = {
  getStockNotifications,
  createStockNotification,
  updateStockNotification,
  getPartnerStockNotifications,
  getLowStockAlerts
};