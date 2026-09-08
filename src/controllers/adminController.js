const db = require('../config/db');

// GET /api/admin/orders
// Returns every order across all customers, most recent first — with
// customer contact info and line items, so the admin can act on each one.
async function listAllOrders(req, res) {
  const ordersResult = await db.query(
    `SELECT o.*, u.name AS customer_name, u.phone AS customer_phone, u.email AS customer_email,
            a.line1, a.city, a.pincode, a.recipient_name, a.delivery_instructions,
            a.title, a.contact_number, a.latitude, a.longitude, a.locality
     FROM orders o
     JOIN users u ON u.id = o.user_id
     JOIN addresses a ON a.id = o.address_id
     ORDER BY o.created_at DESC`
  );

  const orders = ordersResult.rows;
  for (const order of orders) {
    const itemsResult = await db.query(
      `SELECT oi.*, p.name AS product_name FROM order_items oi
       JOIN products p ON p.id = oi.product_id WHERE oi.order_id = $1`,
      [order.id]
    );
    order.items = itemsResult.rows;
  }

  res.json(orders);
}

// PATCH /api/admin/orders/:id
// Body: { status } — one of: confirmed | out_for_delivery | delivered | cancelled
async function updateOrderStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body;

  const validStatuses = ['placed', 'confirmed', 'out_for_delivery', 'delivered', 'cancelled'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `Status must be one of: ${validStatuses.join(', ')}` });
  }

  const result = await db.query(
    `UPDATE orders SET status = $1, updated_at = now(), delivered_at = CASE WHEN $1 = 'delivered' THEN now() ELSE delivered_at END WHERE id = $2 RETURNING *`,
    [status, id]
  );

  if (result.rows.length === 0) return res.status(404).json({ error: 'Order not found' });
  res.json(result.rows[0]);
}

// GET /api/admin/stats
// Quick summary numbers for a dashboard header.
async function getStats(req, res) {
  const today = new Date().toISOString().slice(0, 10);

  const todayOrders = await db.query(
    `SELECT COUNT(*)::int AS count, COALESCE(SUM(total), 0) AS revenue
     FROM orders WHERE created_at::date = $1`,
    [today]
  );
  const pending = await db.query(
    `SELECT COUNT(*)::int AS count FROM orders WHERE status IN ('placed', 'confirmed')`
  );

  res.json({
    todayOrders: todayOrders.rows[0].count,
    todayRevenue: parseFloat(todayOrders.rows[0].revenue),
    pendingOrders: pending.rows[0].count,
  });
}

// GET /api/admin/locality-summary
// Daily sales summary grouped by locality
async function getLocalitySummary(req, res) {
  const today = new Date().toISOString().slice(0, 10);

  const summary = await db.query(
    `SELECT 
      COALESCE(a.locality, 'Unknown') AS locality,
      COUNT(*)::int AS orders_count,
      COALESCE(SUM(o.total), 0) AS revenue,
      COUNT(DISTINCT o.user_id) AS unique_customers
     FROM orders o
     JOIN addresses a ON a.id = o.address_id
     WHERE o.created_at::date = $1
     GROUP BY a.locality
     ORDER BY revenue DESC`,
    [today]
  );

  res.json(summary.rows);
}

// POST /api/admin/orders/:id/notify
async function triggerSemiAutoNotification(req, res) {
  const { id } = req.params;
  const { type } = req.body; // 'ORDER_CONFIRMED' or 'DISPATCHED'

  try {
    const orderRes = await db.query(
      `SELECT o.*, u.phone, u.name FROM orders o JOIN users u ON u.id = o.user_id WHERE o.id = $1`,
      [id]
    );

    if (orderRes.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orderRes.rows[0];

    if (type === 'ORDER_CONFIRMED') {
      console.log(`[Semi-Auto Trigger] Notification triggered for ${order.phone}: "Your morning essentials order #${order.id} is confirmed!"`);
    } else if (type === 'DISPATCHED') {
      console.log(`[Semi-Auto Trigger] Notification triggered for ${order.phone}: "Your order #${order.id} is on the way!"`);
    }

    res.json({ success: true, message: `Notification '${type}' triggered for Order #${id}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// POST /api/admin/disputes/resolve
async function resolveDispute(req, res) {
  const { order_id, resolution, partner_id, reason } = req.body; 
  // resolution: 'PARTNER_FAULT' or 'DISMISSED'

  try {
    if (resolution === 'PARTNER_FAULT') {
      await db.query(
        `INSERT INTO partner_warnings (partner_id, order_id, reason, severity) VALUES ($1, $2, $3, 'strike')`,
        [partner_id, order_id, reason || 'Customer dispute - Partner fault']
      );
      await db.query(`UPDATE partner_payouts SET status = 'DEDUCTED' WHERE order_id = $1`, [order_id]);
      await db.query(`UPDATE orders SET status = 'DISPUTED' WHERE id = $1`, [order_id]);
    } else if (resolution === 'DISMISSED') {
      await db.query(`UPDATE orders SET status = 'FULFILLED' WHERE id = $1`, [order_id]);
      await db.query(`UPDATE partner_payouts SET status = 'CLEARED', cleared_at = now() WHERE order_id = $1`, [order_id]);
    }

    res.json({ success: true, message: `Dispute resolved with status: ${resolution}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// NEW: Partner Management Functions

// GET /api/admin/partners
async function listPartners(req, res) {
  try {
    const result = await db.query(
      `SELECT * FROM partners ORDER BY created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching partners:', err);
    res.status(500).json({ error: 'Failed to fetch partners' });
  }
}

// POST /api/admin/partners
async function addPartner(req, res) {
  const { name, phone, email, address, category } = req.body;

  if (!name || !phone) {
    return res.status(400).json({ error: 'Name and phone are required' });
  }

  try {
    const result = await db.query(
      `INSERT INTO partners (name, phone, email, address, category, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, now(), now())
       RETURNING *`,
      [name, phone, email || null, address || null, category || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error adding partner:', err);
    res.status(500).json({ error: 'Failed to add partner' });
  }
}

// PUT /api/admin/partners/:id
async function updatePartner(req, res) {
  const { id } = req.params;
  const { name, phone, email, address, category } = req.body;

  if (!name || !phone) {
    return res.status(400).json({ error: 'Name and phone are required' });
  }

  try {
    const result = await db.query(
      `UPDATE partners 
       SET name = $1, phone = $2, email = $3, address = $4, category = $5, updated_at = now()
       WHERE id = $6
       RETURNING *`,
      [name, phone, email || null, address || null, category || null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Partner not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating partner:', err);
    res.status(500).json({ error: 'Failed to update partner' });
  }
}

// DELETE /api/admin/partners/:id
async function deletePartner(req, res) {
  const { id } = req.params;

  try {
    const result = await db.query(
      `DELETE FROM partners WHERE id = $1 RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Partner not found' });
    }

    res.json({ success: true, message: 'Partner deleted successfully' });
  } catch (err) {
    console.error('Error deleting partner:', err);
    res.status(500).json({ error: 'Failed to delete partner' });
  }
}

// PATCH /api/admin/orders/:id/assign
async function assignOrderToPartner(req, res) {
  const { id } = req.params;
  const { partner_id } = req.body;

  if (!partner_id) {
    return res.status(400).json({ error: 'Partner ID is required' });
  }

  try {
    // Verify partner exists
    const partnerCheck = await db.query(
      `SELECT id FROM partners WHERE id = $1`,
      [partner_id]
    );

    if (partnerCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Partner not found' });
    }

    const result = await db.query(
      `UPDATE orders 
       SET partner_id = $1, updated_at = now()
       WHERE id = $2
       RETURNING *`,
      [partner_id, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error assigning order to partner:', err);
    res.status(500).json({ error: 'Failed to assign order to partner' });
  }
}

// GET /api/admin/complaints - Get all complaints for admin review
async function getComplaints(req, res) {
  try {
    const result = await db.query(
      `SELECT c.*, u.name as customer_name, u.phone as customer_phone, 
              o.total as order_total, o.status as order_status,
              p.name as partner_name, p.total_strikes as partner_strikes
       FROM complaints c
       JOIN users u ON u.id = c.user_id
       JOIN orders o ON o.id = c.order_id
       LEFT JOIN partners p ON p.id = c.partner_id
       ORDER BY c.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching complaints:', err);
    res.status(500).json({ error: 'Failed to fetch complaints' });
  }
}

// POST /api/admin/complaints/:id/escalate - Escalate complaint to partner with strike
async function escalateComplaint(req, res) {
  const { id } = req.params;
  const { partner_id, severity, reason } = req.body;

  if (!partner_id) {
    return res.status(400).json({ error: 'Partner ID is required' });
  }

  try {
    // Get complaint details
    const complaintResult = await db.query(
      'SELECT * FROM complaints WHERE id = $1',
      [id]
    );

    if (complaintResult.rows.length === 0) {
      return res.status(404).json({ error: 'Complaint not found' });
    }

    const complaint = complaintResult.rows[0];

    // Import strike creation function
    const { createPartnerStrike } = require('./feedbackController');
    
    // Create strike for partner
    const strikeCount = await createPartnerStrike(
      partner_id, 
      complaint.order_id, 
      complaint.id, 
      reason || `Complaint escalation: ${complaint.subject}`,
      severity || 'warning'
    );

    // Update complaint with partner assignment and escalation level
    await db.query(
      `UPDATE complaints 
       SET partner_id = $1, escalation_level = escalation_level + 1, is_partner_notified = true
       WHERE id = $2`,
      [partner_id, id]
    );

    // Get updated partner status
    const partnerResult = await db.query(
      'SELECT * FROM partners WHERE id = $1',
      [partner_id]
    );

    res.json({
      success: true,
      message: `Complaint escalated to partner with strike ${strikeCount}/5`,
      strike_count: strikeCount,
      partner: partnerResult.rows[0]
    });
  } catch (err) {
    console.error('Error escalating complaint:', err);
    res.status(500).json({ error: 'Failed to escalate complaint' });
  }
}

// POST /api/admin/complaints/:id/resolve - Resolve complaint without partner escalation
async function resolveComplaintDirectly(req, res) {
  const { id } = req.params;
  const { admin_notes, resolution } = req.body;

  try {
    const result = await db.query(
      `UPDATE complaints 
       SET status = 'resolved', admin_notes = $1, updated_at = now()
       WHERE id = $2
       RETURNING *`,
      [admin_notes || resolution || 'Resolved by admin', id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Complaint not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error resolving complaint:', err);
    res.status(500).json({ error: 'Failed to resolve complaint' });
  }
}

// GET /api/admin/partners/:id/warnings - Get warning history for a partner
async function getPartnerWarnings(req, res) {
  const { id } = req.params;

  try {
    const result = await db.query(
      `SELECT pw.*, o.id as order_id, c.subject as complaint_subject
       FROM partner_warnings pw
       LEFT JOIN orders o ON o.id = pw.order_id
       LEFT JOIN complaints c ON c.id = pw.complaint_id
       WHERE pw.partner_id = $1
       ORDER BY pw.created_at DESC`,
      [id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching partner warnings:', err);
    res.status(500).json({ error: 'Failed to fetch partner warnings' });
  }
}

// POST /api/admin/partners/:id/warn - Issue warning to partner (3-strike rule)
async function warnPartner(req, res) {
  const { id } = req.params;
  const { reason } = req.body;

  try {
    // Get current partner status
    const partnerResult = await db.query(
      'SELECT * FROM partners WHERE id = $1',
      [id]
    );

    if (partnerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Partner not found' });
    }

    const partner = partnerResult.rows[0];

    // Increment warning count
    const newWarningCount = (partner.warnings || 0) + 1;

    // Add warning to history
    const warningHistory = partner.warning_history || [];
    warningHistory.push({
      date: new Date().toISOString(),
      reason: reason || 'Warning issued by admin',
      warning_count: newWarningCount
    });

    // Check if partner should be blocked (3 strikes)
    const shouldBlock = newWarningCount >= 3;
    const blockedReason = shouldBlock ? 'Three strikes policy violation' : null;

    await db.query(
      `UPDATE partners 
       SET warnings = $1, warning_count = $1, warning_history = $2, 
           is_active = CASE WHEN $1 >= 3 THEN false ELSE is_active END,
           blocked_reason = CASE WHEN $1 >= 3 THEN $3 ELSE blocked_reason END,
           updated_at = now()
       WHERE id = $4
       RETURNING *`,
      [newWarningCount, JSON.stringify(warningHistory), blockedReason, id]
    );

    const updatedPartner = (await db.query('SELECT * FROM partners WHERE id = $1', [id])).rows[0];

    res.json({
      success: true,
      partner: updatedPartner,
      message: shouldBlock 
        ? `Partner blocked after ${newWarningCount} warnings` 
        : `Warning issued. Total warnings: ${newWarningCount}/3`
    });
  } catch (err) {
    console.error('Error warning partner:', err);
    res.status(500).json({ error: 'Failed to warn partner' });
  }
}

// POST /api/admin/partners/:id/block - Block partner
async function blockPartner(req, res) {
  const { id } = req.params;
  const { reason } = req.body;

  try {
    const result = await db.query(
      `UPDATE partners 
       SET is_active = false, blocked_reason = $1, updated_at = now()
       WHERE id = $2
       RETURNING *`,
      [reason || 'Blocked by admin', id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Partner not found' });
    }

    res.json({
      success: true,
      partner: result.rows[0],
      message: 'Partner blocked successfully'
    });
  } catch (err) {
    console.error('Error blocking partner:', err);
    res.status(500).json({ error: 'Failed to block partner' });
  }
}

// POST /api/admin/partners/:id/unblock - Unblock partner
async function unblockPartner(req, res) {
  const { id } = req.params;

  try {
    const result = await db.query(
      `UPDATE partners 
       SET is_active = true, blocked_reason = NULL, updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Partner not found' });
    }

    res.json({
      success: true,
      partner: result.rows[0],
      message: 'Partner unblocked successfully'
    });
  } catch (err) {
    console.error('Error unblocking partner:', err);
    res.status(500).json({ error: 'Failed to unblock partner' });
  }
}

module.exports = { 
  listAllOrders, 
  updateOrderStatus, 
  getStats, 
  getLocalitySummary,
  triggerSemiAutoNotification,
  resolveDispute,
  listPartners,
  addPartner,
  updatePartner,
  deletePartner,
  assignOrderToPartner,
  getComplaints,
  escalateComplaint,
  resolveComplaintDirectly,
  getPartnerWarnings,
  warnPartner,
  blockPartner,
  unblockPartner
};
