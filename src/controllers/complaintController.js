const db = require('../config/db');
const { createNotification } = require('./notificationController');

// GET /api/complaints
// Get all complaints (admin only)
async function getComplaints(req, res) {
  try {
    const result = await db.query(
      `SELECT c.*, o.id as order_id, o.total as order_total, o.status as order_status,
              u.name as customer_name, u.phone as customer_phone, u.email as customer_email,
              p.name as partner_name, p.id as partner_id
       FROM complaints c
       LEFT JOIN orders o ON c.order_id = o.id
       LEFT JOIN users u ON c.user_id = u.id
       LEFT JOIN partners p ON o.partner_id = p.id
       ORDER BY c.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// GET /api/complaints/:id
// Get single complaint by ID
async function getComplaintById(req, res) {
  const { id } = req.params;
  try {
    const result = await db.query(
      `SELECT c.*, o.id as order_id, o.total as order_total, o.status as order_status,
              u.name as customer_name, u.phone as customer_phone, u.email as customer_email,
              p.name as partner_name, p.id as partner_id
       FROM complaints c
       LEFT JOIN orders o ON c.order_id = o.id
       LEFT JOIN users u ON c.user_id = u.id
       LEFT JOIN partners p ON o.partner_id = p.id
       WHERE c.id = $1`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Complaint not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// POST /api/complaints
// Create a new complaint (customer only)
async function createComplaint(req, res) {
  const { order_id, type, subject, message } = req.body;
  const userId = req.userId; // From auth middleware

  if (!order_id || !type || !subject || !message) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (!['write', 'call'].includes(type)) {
    return res.status(400).json({ error: 'Invalid complaint type' });
  }

  try {
    // Verify order belongs to user
    const orderResult = await db.query(
      'SELECT * FROM orders WHERE id = $1 AND user_id = $2',
      [order_id, userId]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found or does not belong to you' });
    }

    const order = orderResult.rows[0];

    // Create complaint
    const result = await db.query(
      `INSERT INTO complaints (order_id, user_id, type, subject, message, status)
       VALUES ($1, $2, $3, $4, $5, 'pending')
       RETURNING *`,
      [order_id, userId, type, subject, message]
    );

    const complaint = result.rows[0];

    // Notify admin about new complaint
    await createNotification(
      null, // Admin notification (no specific user)
      'complaint',
      'New Complaint Filed',
      `Customer has filed a complaint for order #${order_id}`,
      complaint.id
    );

    res.status(201).json({ success: true, complaint });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// PATCH /api/complaints/:id
// Update complaint status and add admin notes (admin only)
async function updateComplaint(req, res) {
  const { id } = req.params;
  const { status, admin_notes, partner_action } = req.body;

  if (!status || !['pending', 'in_progress', 'resolved', 'closed'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    const result = await db.query(
      `UPDATE complaints 
       SET status = $1, admin_notes = $2, updated_at = now()
       WHERE id = $3
       RETURNING *`,
      [status, admin_notes, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Complaint not found' });
    }

    const complaint = result.rows[0];

    // Handle partner action if specified
    if (partner_action && complaint.order_id) {
      await handlePartnerAction(complaint.order_id, partner_action);
    }

    // Notify customer about complaint update
    await createNotification(
      complaint.user_id,
      'complaint_update',
      'Complaint Status Updated',
      `Your complaint status has been updated to: ${status}`,
      complaint.id
    );

    res.json({ success: true, complaint });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Helper function to handle partner actions (warnings, blocking)
async function handlePartnerAction(orderId, action) {
  try {
    const orderResult = await db.query(
      'SELECT partner_id FROM orders WHERE id = $1',
      [orderId]
    );

    if (orderResult.rows.length === 0 || !orderResult.rows[0].partner_id) {
      return;
    }

    const partnerId = orderResult.rows[0].partner_id;

    if (action === 'warn') {
      // Add warning to partner record
      await db.query(
        `UPDATE partners 
         SET warnings = COALESCE(warnings, 0) + 1,
             warning_count = COALESCE(warning_count, 0) + 1
         WHERE id = $1`,
        [partnerId]
      );

      // Check if partner should be blocked (3 strikes)
      const partnerResult = await db.query(
        'SELECT warnings FROM partners WHERE id = $1',
        [partnerId]
      );

      if (partnerResult.rows[0].warnings >= 3) {
        await db.query(
          `UPDATE partners 
           SET is_active = false, blocked_reason = 'Three strikes policy'
           WHERE id = $1`,
          [partnerId]
        );
      }
    } else if (action === 'block') {
      await db.query(
        `UPDATE partners 
         SET is_active = false, blocked_reason = 'Admin action - complaint resolution'
         WHERE id = $1`,
        [partnerId]
      );
    }
  } catch (err) {
    console.error('Error handling partner action:', err);
  }
}

// GET /api/feedback
// Get all feedback (admin only)
async function getFeedback(req, res) {
  try {
    const result = await db.query(
      `SELECT f.*, o.id as order_id, o.total as order_total,
              u.name as customer_name, u.phone as customer_phone
       FROM feedback f
       LEFT JOIN orders o ON f.order_id = o.id
       LEFT JOIN users u ON f.user_id = u.id
       ORDER BY f.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// GET /api/feedback/:id
// Get single feedback by ID
async function getFeedbackById(req, res) {
  const { id } = req.params;
  try {
    const result = await db.query(
      `SELECT f.*, o.id as order_id, o.total as order_total,
              u.name as customer_name, u.phone as customer_phone
       FROM feedback f
       LEFT JOIN orders o ON f.order_id = o.id
       LEFT JOIN users u ON f.user_id = u.id
       WHERE f.id = $1`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Feedback not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// POST /api/feedback
// Create feedback (customer only, 1 hour after delivery)
async function createFeedback(req, res) {
  const { order_id, rating, comment } = req.body;
  const userId = req.userId;

  if (!order_id || !rating) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'Rating must be between 1 and 5' });
  }

  try {
    // Verify order belongs to user and was delivered at least 1 hour ago
    const orderResult = await db.query(
      `SELECT * FROM orders 
       WHERE id = $1 AND user_id = $2 AND status = 'delivered'`,
      [order_id, userId]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found, not delivered, or does not belong to you' });
    }

    const order = orderResult.rows[0];

    // Check if 1 hour has passed since delivery
    if (!order.delivered_at) {
      return res.status(400).json({ error: 'Order delivery time not recorded' });
    }

    const deliveryTime = new Date(order.delivered_at);
    const currentTime = new Date();
    const hoursSinceDelivery = (currentTime - deliveryTime) / (1000 * 60 * 60);

    if (hoursSinceDelivery < 1) {
      return res.status(400).json({ 
        error: 'Feedback can only be submitted 1 hour after delivery',
        hours_remaining: 1 - hoursSinceDelivery
      });
    }

    // Check if feedback already exists
    const existingFeedback = await db.query(
      'SELECT * FROM feedback WHERE order_id = $1 AND user_id = $2',
      [order_id, userId]
    );

    if (existingFeedback.rows.length > 0) {
      return res.status(400).json({ error: 'Feedback already submitted for this order' });
    }

    // Create feedback
    const result = await db.query(
      `INSERT INTO feedback (order_id, user_id, rating, comment)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [order_id, userId, rating, comment]
    );

    res.status(201).json({ success: true, feedback: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  getComplaints,
  getComplaintById,
  createComplaint,
  updateComplaint,
  getFeedback,
  getFeedbackById,
  createFeedback,
};