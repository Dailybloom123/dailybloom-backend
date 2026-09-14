const db = require('../config/db');
const { createNotification } = require('./notificationController');

// Order status definitions
const ORDER_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  PREPARING: 'preparing',
  READY_FOR_PICKUP: 'ready_for_pickup',
  OUT_FOR_DELIVERY: 'out_for_delivery',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
  REJECTED: 'rejected'
};

// Get order by ID with full details
const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const userRole = req.user.role;

    let query, params;

    // Different access based on role
    if (userRole === 'admin') {
      query = `SELECT o.*, u.name as customer_name, u.phone as customer_phone, a.recipient_name, a.line1, a.locality, a.pincode 
               FROM orders o 
               LEFT JOIN users u ON o.user_id = u.id 
               LEFT JOIN addresses a ON o.address_id = a.id 
               WHERE o.id = $1`;
      params = [id];
    } else if (userRole === 'partner') {
      query = `SELECT o.*, u.name as customer_name, u.phone as customer_phone, a.recipient_name, a.line1, a.locality, a.pincode 
               FROM orders o 
               LEFT JOIN users u ON o.user_id = u.id 
               LEFT JOIN addresses a ON o.address_id = a.id 
               WHERE o.id = $1 AND o.assigned_partner_id = $2`;
      params = [id, userId];
    } else {
      query = `SELECT o.*, a.recipient_name, a.line1, a.locality, a.pincode 
               FROM orders o 
               LEFT JOIN addresses a ON o.address_id = a.id 
               WHERE o.id = $1 AND o.user_id = $2`;
      params = [id, userId];
    }

    const result = await db.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Get order items
    const itemsResult = await db.query(
      `SELECT oi.*, p.name as product_name, p.unit 
       FROM order_items oi 
       LEFT JOIN products p ON oi.product_id = p.id 
       WHERE oi.order_id = $1`,
      [id]
    );

    const order = result.rows[0];
    order.items = itemsResult.rows;

    // Get order status history
    const statusHistory = await db.query(
      `SELECT * FROM order_status_history 
       WHERE order_id = $1 
       ORDER BY created_at DESC`,
      [id]
    );

    order.status_history = statusHistory.rows;

    res.json(order);
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
};

// Update order status
const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes, estimated_delivery_time, current_location } = req.body;
    const userId = req.user.userId;
    const userRole = req.user.role;

    // Validate status
    const validStatuses = Object.values(ORDER_STATUS);
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // Get current order
      const orderResult = await client.query(
        'SELECT * FROM orders WHERE id = $1 FOR UPDATE',
        [id]
      );

      if (orderResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Order not found' });
      }

      const order = orderResult.rows[0];

      // Permission check
      if (userRole === 'partner' && order.assigned_partner_id !== userId) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'Not authorized to update this order' });
      }

      // Update order status
      const updateQuery = `
        UPDATE orders 
        SET status = $1, 
            updated_at = NOW(),
            ${estimated_delivery_time ? 'estimated_delivery_time = $2,' : ''}
            ${current_location ? 'current_location = $3,' : ''}
            notes = COALESCE($4, notes)
        WHERE id = $5
        RETURNING *
      `;

      const params = [status];
      let paramIndex = 2;

      if (estimated_delivery_time) {
        params.push(estimated_delivery_time);
        paramIndex++;
      }
      if (current_location) {
        params.push(current_location);
        paramIndex++;
      }
      params.push(notes);
      params.push(id);

      const result = await client.query(updateQuery, params);
      const updatedOrder = result.rows[0];

      // Add status history entry
      await client.query(
        `INSERT INTO order_status_history (order_id, status, notes, changed_by, changed_by_role)
         VALUES ($1, $2, $3, $4, $5)`,
        [id, status, notes, userId, userRole]
      );

      // Create notification for customer
      if (userRole === 'admin' || userRole === 'partner') {
        await createNotification(
          order.user_id,
          `Order #${id.slice(-6)} status updated to ${status}`,
          'order_update',
          { order_id: id, status }
        );
      }

      await client.query('COMMIT');

      res.json(updatedOrder);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ error: 'Failed to update order status' });
  }
};

// Assign order to partner
const assignOrderToPartner = async (req, res) => {
  try {
    const { id } = req.params;
    const { partner_id } = req.body;

    const result = await db.query(
      `UPDATE orders 
       SET assigned_partner_id = $1, status = 'confirmed', updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [partner_id, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Add status history
    await db.query(
      `INSERT INTO order_status_history (order_id, status, notes, changed_by, changed_by_role)
       VALUES ($1, 'confirmed', 'Order assigned to partner', $2, 'admin')`,
      [id, req.user.userId]
    );

    // Notify partner
    await createNotification(
      partner_id,
      `New order #${id.slice(-6)} assigned to you`,
      'new_order',
      { order_id: id }
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error assigning order:', error);
    res.status(500).json({ error: 'Failed to assign order' });
  }
};

// Get orders by status (for admin/partner dashboards)
const getOrdersByStatus = async (req, res) => {
  try {
    const { status } = req.params;
    const userRole = req.user.role;
    const userId = req.user.userId;

    let query, params;

    if (userRole === 'admin') {
      query = `SELECT o.*, u.name as customer_name, p.name as partner_name 
               FROM orders o 
               LEFT JOIN users u ON o.user_id = u.id 
               LEFT JOIN partners p ON o.assigned_partner_id = p.id 
               WHERE o.status = $1 
               ORDER BY o.created_at DESC`;
      params = [status];
    } else if (userRole === 'partner') {
      query = `SELECT o.*, u.name as customer_name 
               FROM orders o 
               LEFT JOIN users u ON o.user_id = u.id 
               WHERE o.status = $1 AND o.assigned_partner_id = $2 
               ORDER BY o.created_at DESC`;
      params = [status, userId];
    } else {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching orders by status:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
};

// Get order tracking timeline
const getOrderTracking = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT * FROM order_status_history 
       WHERE order_id = $1 
       ORDER BY created_at ASC`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Format timeline for frontend
    const timeline = result.rows.map(entry => ({
      status: entry.status,
      timestamp: entry.created_at,
      notes: entry.notes,
      changed_by: entry.changed_by_role === 'admin' ? 'Admin' : 'Partner'
    }));

    res.json(timeline);
  } catch (error) {
    console.error('Error fetching order tracking:', error);
    res.status(500).json({ error: 'Failed to fetch order tracking' });
  }
};

// Get real-time order updates (for polling)
const getOrderUpdates = async (req, res) => {
  try {
    const { since } = req.query; // Timestamp to check for updates since
    const userId = req.user.userId;
    const userRole = req.user.role;

    let query, params;

    if (userRole === 'customer') {
      query = `SELECT o.*, 
               (SELECT COUNT(*) FROM order_status_history osh 
                WHERE osh.order_id = o.id AND osh.created_at > $1) as has_updates
               FROM orders o 
               WHERE o.user_id = $2 AND o.updated_at > $1`;
      params = [since, userId];
    } else if (userRole === 'partner') {
      query = `SELECT o.*, 
               (SELECT COUNT(*) FROM order_status_history osh 
                WHERE osh.order_id = o.id AND osh.created_at > $1) as has_updates
               FROM orders o 
               WHERE o.assigned_partner_id = $2 AND o.updated_at > $1`;
      params = [since, userId];
    } else {
      query = `SELECT o.*, 
               (SELECT COUNT(*) FROM order_status_history osh 
                WHERE osh.order_id = o.id AND osh.created_at > $1) as has_updates
               FROM orders o 
               WHERE o.updated_at > $1`;
      params = [since];
    }

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching order updates:', error);
    res.status(500).json({ error: 'Failed to fetch order updates' });
  }
};

module.exports = {
  getOrderById,
  updateOrderStatus,
  assignOrderToPartner,
  getOrdersByStatus,
  getOrderTracking,
  getOrderUpdates,
  ORDER_STATUS
};