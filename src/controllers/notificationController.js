const db = require('../config/db');

// Email sending via Resend API
async function sendEmail(to, subject, htmlContent) {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.log('[DEV ONLY - Resend not configured] Email would be sent to:', to);
      return { delivered: false, reason: 'Resend API key not configured' };
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'DailyBloom <orders@dailybloom.com>',
        to: to,
        subject: subject,
        html: htmlContent,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Resend email failed:', error);
      return { delivered: false, reason: error };
    }

    return { delivered: true };
  } catch (err) {
    console.error('Email send error:', err.message);
    return { delivered: false, reason: err.message };
  }
}

// SMS sending via MSG91 API
async function sendSMS(phone, message) {
  try {
    const authKey = process.env.MSG91_AUTH_KEY;
    if (!authKey) {
      console.log(`[DEV ONLY - MSG91 not configured] SMS would be sent to ${phone}: ${message}`);
      return { delivered: false, reason: 'MSG91 auth key not configured' };
    }

    const response = await fetch(`https://control.msg91.com/api/v5/flow/`, {
      method: 'POST',
      headers: {
        'authkey': authKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        template_id: process.env.MSG91_TEMPLATE_ID,
        short_url: '1',
        recipients: [
          {
            mobiles: phone,
            VAR1: message,
          },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('MSG91 SMS failed:', error);
      return { delivered: false, reason: error };
    }

    return { delivered: true };
  } catch (err) {
    console.error('SMS send error:', err.message);
    return { delivered: false, reason: err.message };
  }
}

// Send order notification via SMS and Email
async function sendOrderNotification(userId, type, title, message, relatedOrderId = null) {
  try {
    // Get user details
    const userResult = await db.query(
      'SELECT * FROM users WHERE id = $1',
      [userId]
    );
    if (userResult.rows.length === 0) return;
    
    const user = userResult.rows[0];
    
    // Send Email
    if (user.email) {
      const emailSubject = `DailyBloom: ${title}`;
      const emailContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #F8F9F5; padding: 20px; border-radius: 10px;">
            <h2 style="color: #1A2E23; margin-bottom: 10px;">${title}</h2>
            <p style="color: #4A5D52; line-height: 1.6;">${message}</p>
            ${relatedOrderId ? `<p style="margin-top: 20px; color: #4A5D52;">Order ID: ${relatedOrderId}</p>` : ''}
            <p style="margin-top: 20px; color: #4A5D52;">Thank you for choosing DailyBloom!</p>
          </div>
        </div>
      `;
      await sendEmail(user.email, emailSubject, emailContent);
    }
    
    // Send SMS (for critical order updates)
    if (user.phone && ['order_update', 'order_verification'].includes(type)) {
      const smsMessage = `${title}: ${message}`.substring(0, 160);
      await sendSMS(user.phone, smsMessage);
    }
  } catch (err) {
    console.error('Order notification error:', err);
    // Don't fail the operation if notification fails
  }
}

// GET /api/notifications
// Get all notifications for the logged-in user
async function getNotifications(req, res) {
  const userId = req.userId;
  
  const result = await db.query(
    `SELECT * FROM notifications 
     WHERE user_id = $1 
     ORDER BY created_at DESC`,
    [userId]
  );
  
  res.json(result.rows);
}

// POST /api/notifications/:id/read
// Mark a notification as read
async function markAsRead(req, res) {
  const { id } = req.params;
  const userId = req.userId;
  
  const result = await db.query(
    `UPDATE notifications 
     SET is_read = true 
     WHERE id = $1 AND user_id = $2 
     RETURNING *`,
    [id, userId]
  );
  
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Notification not found' });
  }
  
  res.json(result.rows[0]);
}

// POST /api/notifications/mark-all-read
// Mark all notifications as read for the user
async function markAllAsRead(req, res) {
  const userId = req.userId;
  
  await db.query(
    `UPDATE notifications 
     SET is_read = true 
     WHERE user_id = $1 AND is_read = false`,
    [userId]
  );
  
  res.json({ message: 'All notifications marked as read' });
}

// Helper function to create a notification (used internally)
async function createNotification(userId, type, title, message, relatedOrderId = null, relatedProductId = null) {
  const result = await db.query(
    `INSERT INTO notifications (user_id, type, title, message, related_order_id, related_product_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [userId, type, title, message, relatedOrderId, relatedProductId]
  );
  
  // Also send SMS/Email for order-related notifications
  if (type.startsWith('order')) {
    await sendOrderNotification(userId, type, title, message, relatedOrderId);
  }
  
  return result.rows[0];
}

module.exports = { getNotifications, markAsRead, markAllAsRead, createNotification, sendOrderNotification };
