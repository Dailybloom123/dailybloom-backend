const { query } = require('../config/db');

// WhatsApp notification for admin
async function sendAdminWhatsAppNotification(message) {
  try {
    // Using CallMeBot API as configured in .env
    const CALLMEBOT_API_KEY = process.env.CALLMEBOT_API_KEY;
    const CALLMEBOT_PHONE = process.env.CALLMEBOT_PHONE;
    
    if (!CALLMEBOT_API_KEY || !CALLMEBOT_PHONE) {
      console.log('WhatsApp notification skipped - API credentials not configured');
      return;
    }
    
    const encodedMessage = encodeURIComponent(message);
    const url = `https://api.callmebot.com/whatsapp.php?phone=${CALLMEBOT_PHONE}&text=${encodedMessage}&apikey=${CALLMEBOT_API_KEY}`;
    
    await fetch(url);
    console.log('WhatsApp notification sent to admin');
  } catch (error) {
    console.error('Failed to send WhatsApp notification:', error);
    // Don't fail the complaint submission if notification fails
  }
}

// 5-Strike Warning System for Partners
// Creates a strike/warning record when admin escalates a complaint
async function createPartnerStrike(partnerId, orderId, complaintId, reason, severity = 'warning') {
  try {
    if (!partnerId) return;
    
    // Get current strike count for this partner
    const partnerResult = await query(
      'SELECT total_strikes, is_active FROM partners WHERE id = $1',
      [partnerId]
    );
    
    if (partnerResult.rows.length === 0) {
      console.log('Partner not found for strike creation');
      return;
    }
    
    const partner = partnerResult.rows[0];
    
    // Check if partner is already banned
    if (!partner.is_active) {
      console.log(`Partner ${partnerId} is already banned, skipping strike creation`);
      return;
    }
    
    const newStrikeCount = (partner.total_strikes || 0) + 1;
    
    // Create partner warning record
    await query(
      `INSERT INTO partner_warnings (partner_id, order_id, complaint_id, reason, severity, strike_count)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [partnerId, orderId, complaintId, reason, severity, newStrikeCount]
    );
    
    // Update partner's total strikes
    await query(
      `UPDATE partners SET total_strikes = $1, updated_at = now() WHERE id = $2`,
      [newStrikeCount, partnerId]
    );
    
    console.log(`Strike ${newStrikeCount}/5 created for partner ${partnerId}: ${reason}`);
    
    // Auto-ban if 5 strikes reached (trigger will handle this, but we log it)
    if (newStrikeCount >= 5) {
      console.log(`Partner ${partnerId} has reached 5 strikes and will be auto-banned`);
    }
    
    return newStrikeCount;
  } catch (error) {
    console.error('Failed to create partner strike:', error);
    throw error;
  }
}

// Helper: get the definitive delivery timestamp for an order.
// Prefers the dedicated delivered_at column; falls back to updated_at
// for orders created before migration 008 added that column.
function getDeliveryTime(order) {
  return order.delivered_at ? new Date(order.delivered_at) : new Date(order.updated_at);
}

// POST /api/feedback - Submit feedback (available 1 hour AFTER delivery)
async function submitFeedback(req, res) {
  try {
    const userId = req.userId;
    const { order_id, rating, comment } = req.body;

    if (!order_id || rating === undefined || rating === null) {
      return res.status(400).json({ error: 'Order ID and rating are required' });
    }

    const parsedRating = parseInt(rating, 10);
    if (isNaN(parsedRating) || parsedRating < 1 || parsedRating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    // Verify order belongs to user
    const orderResult = await query(
      'SELECT * FROM orders WHERE id = $1 AND user_id = $2',
      [order_id, userId]
    );
    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orderResult.rows[0];

    if (order.status !== 'delivered') {
      return res.status(400).json({ error: 'Feedback can only be submitted for delivered orders' });
    }

    const deliveryTime = getDeliveryTime(order);
    const feedbackUnlocksAt = new Date(deliveryTime.getTime() + 60 * 60 * 1000);
    const now = new Date();

    if (now < feedbackUnlocksAt) {
      const minutesLeft = Math.ceil((feedbackUnlocksAt - now) / (60 * 1000));
      return res.status(400).json({
        error: `Feedback will be available in ${minutesLeft} minute(s) after delivery`,
        minutesLeft,
      });
    }

    // Prevent duplicate feedback
    const existingFeedback = await query(
      'SELECT id FROM feedback WHERE order_id = $1 AND user_id = $2',
      [order_id, userId]
    );
    if (existingFeedback.rows.length > 0) {
      return res.status(400).json({ error: 'Feedback already submitted for this order' });
    }

    const result = await query(
      'INSERT INTO feedback (order_id, user_id, rating, comment) VALUES ($1, $2, $3, $4) RETURNING *',
      [order_id, userId, parsedRating, comment ? comment.trim() : null]
    );

    // Automated Partner Warning System
    // Create warning if feedback is negative (rating <= 2) for fulfilled orders
    if (parsedRating <= 2) {
      const reason = comment ? `Negative feedback (${parsedRating}/5): ${comment}` : `Negative feedback (${parsedRating}/5)`;
      const severity = parsedRating === 1 ? 'high' : 'medium';
      await createPartnerWarning(order_id, userId, reason, severity);
    }

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Feedback submission error:', error);
    res.status(500).json({ error: 'Failed to submit feedback' });
  }
}

// GET /api/feedback/:orderId - Get feedback for a specific order
async function getFeedback(req, res) {
  try {
    const userId = req.userId;
    const { orderId } = req.params;

    const result = await query(
      'SELECT * FROM feedback WHERE order_id = $1 AND user_id = $2',
      [orderId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Feedback not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get feedback error:', error);
    res.status(500).json({ error: 'Failed to fetch feedback' });
  }
}

// POST /api/complaints - Submit a complaint (within 1 hour of delivery)
async function submitComplaint(req, res) {
  try {
    const userId = req.userId;
    const { order_id, type, subject, message } = req.body;

    if (!order_id || !type || !message) {
      return res.status(400).json({ error: 'Order ID, type, and message are required' });
    }

    if (type !== 'write' && type !== 'call') {
      return res.status(400).json({ error: 'Type must be "write" or "call"' });
    }

    // For "write" complaints, subject is required
    if (type === 'write' && !subject) {
      return res.status(400).json({ error: 'Subject is required for written complaints' });
    }

    // Verify order belongs to user
    const orderResult = await query(
      'SELECT * FROM orders WHERE id = $1 AND user_id = $2',
      [order_id, userId]
    );
    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orderResult.rows[0];

    if (order.status !== 'delivered') {
      return res.status(400).json({ error: 'Complaints can only be filed for delivered orders' });
    }

    const deliveryTime = getDeliveryTime(order);
    const complaintWindowEndsAt = new Date(deliveryTime.getTime() + 60 * 60 * 1000);
    const now = new Date();

    if (now > complaintWindowEndsAt) {
      return res.status(400).json({
        error: 'Complaint window has closed. Complaints must be filed within 1 hour of delivery.',
      });
    }

    // Prevent duplicate complaints per order
    const existingComplaint = await query(
      'SELECT id FROM complaints WHERE order_id = $1 AND user_id = $2',
      [order_id, userId]
    );
    if (existingComplaint.rows.length > 0) {
      return res.status(400).json({ error: 'A complaint has already been filed for this order' });
    }

    const safeSubject = subject ? subject.trim() : (type === 'call' ? 'Customer requested a call' : '');
    const safeMessage = message.trim();

    // Create complaint with admin routing (no direct partner notification)
    const result = await query(
      `INSERT INTO complaints (order_id, user_id, type, subject, message, partner_id, admin_whatsapp_notified) 
       VALUES ($1, $2, $3, $4, $5, $6, false) 
       RETURNING *`,
      [order_id, userId, type, safeSubject, safeMessage, order.partner_id || null]
    );

    // Send WhatsApp notification to admin
    const adminMessage = `🚨 NEW COMPLIMENT 🚨\n\nOrder: #${order_id}\nType: ${type}\nSubject: ${safeSubject}\nMessage: ${safeMessage}\n\nPlease review in Admin Dashboard.`;
    await sendAdminWhatsAppNotification(adminMessage);

    // Mark admin as notified
    await query(
      'UPDATE complaints SET admin_whatsapp_notified = true WHERE id = $1',
      [result.rows[0].id]
    );

    console.log(`Complaint ${result.rows[0].id} submitted and routed to admin for order ${order_id}`);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Complaint submission error:', error);
    res.status(500).json({ error: 'Failed to submit complaint' });
  }
}

// GET /api/complaints - Get all complaints for the logged-in user
async function getUserComplaints(req, res) {
  try {
    const userId = req.userId;

    const result = await query(
      `SELECT c.*, o.total as order_total
       FROM complaints c
       JOIN orders o ON c.order_id = o.id
       WHERE c.user_id = $1
       ORDER BY c.created_at DESC`,
      [userId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get complaints error:', error);
    res.status(500).json({ error: 'Failed to fetch complaints' });
  }
}

// GET /api/orders/:orderId/complaint-status
// Returns whether the user can still file a complaint and how many minutes remain
async function getComplaintStatus(req, res) {
  try {
    const userId = req.userId;
    const { orderId } = req.params;

    const orderResult = await query(
      'SELECT * FROM orders WHERE id = $1 AND user_id = $2',
      [orderId, userId]
    );
    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orderResult.rows[0];

    if (order.status !== 'delivered') {
      return res.json({ canFileComplaint: false, reason: 'Order not yet delivered' });
    }

    const deliveryTime = getDeliveryTime(order);
    const complaintWindowEndsAt = new Date(deliveryTime.getTime() + 60 * 60 * 1000);
    const now = new Date();

    if (now > complaintWindowEndsAt) {
      return res.json({ canFileComplaint: false, reason: 'Complaint window has closed' });
    }

    // Check if complaint already filed
    const existingComplaint = await query(
      'SELECT id, type, status FROM complaints WHERE order_id = $1 AND user_id = $2',
      [orderId, userId]
    );

    if (existingComplaint.rows.length > 0) {
      return res.json({
        canFileComplaint: false,
        reason: 'Complaint already filed for this order',
        complaint: existingComplaint.rows[0],
      });
    }

    const minutesLeft = Math.ceil((complaintWindowEndsAt - now) / (60 * 1000));
    return res.json({ canFileComplaint: true, minutesLeft });
  } catch (error) {
    console.error('Get complaint status error:', error);
    res.status(500).json({ error: 'Failed to check complaint status' });
  }
}

// GET /api/orders/:orderId/feedback-status
// Returns whether the user can submit feedback and how many minutes remain until they can
async function getFeedbackStatus(req, res) {
  try {
    const userId = req.userId;
    const { orderId } = req.params;

    const orderResult = await query(
      'SELECT * FROM orders WHERE id = $1 AND user_id = $2',
      [orderId, userId]
    );
    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orderResult.rows[0];

    if (order.status !== 'delivered') {
      return res.json({ canSubmitFeedback: false, reason: 'Order not yet delivered' });
    }

    const deliveryTime = getDeliveryTime(order);
    const feedbackUnlocksAt = new Date(deliveryTime.getTime() + 60 * 60 * 1000);
    const now = new Date();

    if (now < feedbackUnlocksAt) {
      const minutesLeft = Math.ceil((feedbackUnlocksAt - now) / (60 * 1000));
      return res.json({
        canSubmitFeedback: false,
        reason: `Feedback unlocks in ${minutesLeft} minute(s)`,
        minutesLeft,
      });
    }

    // Check if feedback already submitted
    const existingFeedback = await query(
      'SELECT id, rating, comment, created_at FROM feedback WHERE order_id = $1 AND user_id = $2',
      [orderId, userId]
    );

    if (existingFeedback.rows.length > 0) {
      return res.json({
        canSubmitFeedback: false,
        reason: 'Feedback already submitted',
        feedback: existingFeedback.rows[0],
      });
    }

    return res.json({ canSubmitFeedback: true });
  } catch (error) {
    console.error('Get feedback status error:', error);
    res.status(500).json({ error: 'Failed to check feedback status' });
  }
}

module.exports = {
  submitFeedback,
  getFeedback,
  submitComplaint,
  getUserComplaints,
  getComplaintStatus,
  getFeedbackStatus,
};
