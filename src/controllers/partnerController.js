const db = require('../config/db');
const { createNotification } = require('./notificationController');

// Robust transaction helper
async function executeTransaction(operations) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const result = await operations(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Valid order status transitions for 5-state lifecycle
const VALID_TRANSITIONS = {
  pending: ['approved', 'cancelled'],
  approved: ['out_for_delivery', 'cancelled'],
  out_for_delivery: ['delivered_unverified', 'cancelled'],
  delivered_unverified: ['fulfilled', 'cancelled'],
  fulfilled: [],
  cancelled: [],
};

// Robust error response helper
const sendErrorResponse = (res, statusCode, message, details = null) => {
  const errorResponse = {
    success: false,
    error: message,
    timestamp: new Date().toISOString()
  };
  
  if (details) {
    errorResponse.details = details;
  }
  
  console.error(`[Partner API Error ${statusCode}]: ${message}`, details || '');
  return res.status(statusCode).json(errorResponse);
};

// GET /api/partner/available-orders
// Returns orders available for this partner to accept (category-matched, unassigned)
async function getAvailableOrders(req, res) {
  const partnerId = req.partnerId;
  try {
    // Get partner's category
    const partnerResult = await db.query(
      'SELECT category FROM partners WHERE id = $1',
      [partnerId]
    );
    
    if (partnerResult.rows.length === 0) {
      return sendErrorResponse(res, 404, 'Partner not found');
    }
    
    const partnerCategory = partnerResult.rows[0].category;
    
    // Get orders that are:
    // 1. In pending_approval status
    // 2. Have items from partner's category
    // 3. Not yet assigned to any partner
    const result = await db.query(
      `SELECT DISTINCT o.*, u.name AS customer_name, u.phone AS customer_phone,
                a.line1, a.city, a.pincode, a.locality, a.latitude, a.longitude
         FROM orders o
         JOIN users u ON u.id = o.user_id
         JOIN addresses a ON a.id = o.address_id
         JOIN order_items oi ON oi.order_id = o.id
         JOIN products p ON p.id = oi.product_id
         WHERE o.status = 'pending_approval'
         AND o.partner_id IS NULL
         AND p.category = $1
         ORDER BY o.created_at ASC`,
      [partnerCategory]
    );

    const orders = result.rows;
    for (const order of orders) {
      const itemsResult = await db.query(
        `SELECT oi.*, p.name AS product_name, p.category 
         FROM order_items oi
         JOIN products p ON p.id = oi.product_id 
         WHERE oi.order_id = $1`,
        [order.id]
      );
      order.items = itemsResult.rows;

      if (order.latitude && order.longitude) {
        order.map_url = `https://www.google.com/maps/dir/?api=1&destination=${order.latitude},${order.longitude}`;
      } else if (order.line1 && order.locality) {
        order.map_url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          `${order.line1}, ${order.locality}, ${order.city}`
        )}`;
      }
    }

    res.json({ success: true, orders });
  } catch (err) {
    console.error('Error fetching available orders:', err);
    sendErrorResponse(res, 500, 'Failed to fetch available orders', err.message);
  }
}

// POST /api/partner/accept-order/:id
// Atomically accepts an order for this partner (first-come-first-serve)
async function acceptOrder(req, res) {
  const { id } = req.params;
  const partnerId = req.partnerId;

  if (!id) {
    return sendErrorResponse(res, 400, 'Order ID is required');
  }

  try {
    // Use transaction for atomic assignment
    const result = await executeTransaction(async (client) => {
      // Get partner details with lock
      const partnerResult = await client.query(
        'SELECT * FROM partners WHERE id = $1 FOR UPDATE',
        [partnerId]
      );
      
      if (partnerResult.rows.length === 0) {
        throw { status: 404, message: 'Partner not found' };
      }
      
      const partner = partnerResult.rows[0];
      
      if (!partner.is_active) {
        throw { status: 403, message: 'Partner account is blocked', details: partner.blocked_reason };
      }

      // Get order details with locking
      const orderResult = await client.query(
        `SELECT o.*, oi.product_id, oi.quantity 
         FROM orders o
         LEFT JOIN order_items oi ON oi.order_id = o.id
         WHERE o.id = $1 FOR UPDATE`,
        [id]
      );

      if (orderResult.rows.length === 0) {
        throw { status: 404, message: 'Order not found' };
      }

      const order = orderResult.rows[0];

      // Check if order is still available
      if (order.status !== 'pending_approval' || order.partner_id !== null) {
        throw { 
          status: 409, 
          message: 'Order is no longer available',
          details: { status: order.status, assigned_to: order.partner_id }
        };
      }

      // Check if order contains items from partner's category
      const categoryCheckResult = await client.query(
        `SELECT COUNT(*) as count
         FROM order_items oi
         JOIN products p ON p.id = oi.product_id
         WHERE oi.order_id = $1 AND p.category = $2`,
        [id, partner.category]
      );

      if (categoryCheckResult.rows[0].count === 0) {
        throw { 
          status: 400, 
          message: 'Order does not contain items from your category',
          details: { partner_category: partner.category }
        };
      }

      // Check stock availability for all items
      for (const item of orderResult.rows) {
        if (!item.product_id) continue;
        
        const stockResult = await client.query(
          'SELECT stock FROM products WHERE id = $1 FOR UPDATE',
          [item.product_id]
        );
        
        if (stockResult.rows.length === 0) {
          throw { 
            status: 400, 
            message: 'Product not found',
            details: { product_id: item.product_id }
          };
        }
        
        if (stockResult.rows[0].stock < item.quantity) {
          throw { 
            status: 400, 
            message: 'Insufficient stock for one or more items',
            details: { 
              product_id: item.product_id, 
              requested_quantity: item.quantity,
              available_stock: stockResult.rows[0].stock 
            }
          };
        }
      }

      // Atomically assign order to partner and update status
      const updateResult = await client.query(
        `UPDATE orders 
         SET partner_id = $1, status = 'approved', updated_at = now() 
         WHERE id = $2 AND partner_id IS NULL 
         RETURNING *`,
        [partnerId, id]
      );

      if (updateResult.rows.length === 0) {
        throw { 
          status: 409, 
          message: 'Order was accepted by another partner',
          details: 'First-come-first-serve assignment failed'
        };
      }

      // Reserve stock for order items
      for (const item of orderResult.rows) {
        if (!item.product_id) continue;
        
        await client.query(
          `UPDATE products 
           SET stock = stock - $1 
           WHERE id = $2`,
          [item.quantity, item.product_id]
        );
      }

      return { order: updateResult.rows[0], partner };
    });

    const updatedOrder = result.order;

    // Notify customer about order confirmation (outside transaction)
    try {
      // Get order user_id for notification
      const orderUserResult = await db.query(
        'SELECT user_id FROM orders WHERE id = $1',
        [id]
      );
      
      if (orderUserResult.rows.length > 0) {
        await createNotification(
          orderUserResult.rows[0].user_id,
          'order_update',
          'Order Confirmed',
          `Your order #${id} has been confirmed and is being prepared.`,
          id
        );
      }
    } catch (notificationError) {
      console.error('Failed to send notification:', notificationError);
      // Don't fail the order acceptance if notification fails
    }

    res.json({ 
      success: true, 
      order: updatedOrder,
      message: 'Order accepted successfully'
    });
  } catch (err) {
    if (err.status) {
      return sendErrorResponse(res, err.status, err.message, err.details);
    }
    console.error('Error accepting order:', err);
    sendErrorResponse(res, 500, 'Failed to accept order', err.message);
  }
}

// GET /api/partner/orders
// Returns orders assigned to partner/vendor with items & Google Maps routing URL
async function getPartnerOrders(req, res) {
  const partnerId = req.partnerId;
  try {
    if (!partnerId) {
      return sendErrorResponse(res, 401, 'Unauthorized: Invalid partner ID');
    }

    const result = await db.query(
      `SELECT o.*, u.name AS customer_name, u.phone AS customer_phone,
                a.line1, a.city, a.pincode, a.locality, a.latitude, a.longitude
         FROM orders o
         JOIN users u ON u.id = o.user_id
         JOIN addresses a ON a.id = o.address_id
         WHERE o.partner_id = $1
         ORDER BY o.created_at DESC`,
      [partnerId]
    );

    const orders = result.rows;
    for (const order of orders) {
      try {
        const itemsResult = await db.query(
          `SELECT oi.*, p.name AS product_name 
           FROM order_items oi
           JOIN products p ON p.id = oi.product_id 
           WHERE oi.order_id = $1`,
          [order.id]
        );
        order.items = itemsResult.rows;

        if (order.latitude && order.longitude) {
          order.map_url = `https://www.google.com/maps/dir/?api=1&destination=${order.latitude},${order.longitude}`;
        } else if (order.line1 && order.locality) {
          order.map_url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
            `${order.line1}, ${order.locality}, ${order.city}`
          )}`;
        }
      } catch (itemError) {
        console.error(`Error fetching items for order ${order.id}:`, itemError);
        order.items = [];
        order.map_url = null;
      }
    }

    res.json({ success: true, orders });
  } catch (err) {
    console.error('Error fetching partner orders:', err);
    sendErrorResponse(res, 500, 'Failed to fetch orders', err.message);
  }
}

// PATCH /api/partner/orders/:id/status
// Updates order status with 5-state lifecycle validation
async function updateOrderStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body;
  const partnerId = req.partnerId;

  if (!id) {
    return sendErrorResponse(res, 400, 'Order ID is required');
  }

  if (!status) {
    return sendErrorResponse(res, 400, 'Status is required');
  }

  try {
    // Get current order and verify it belongs to this partner
    const orderResult = await db.query(
      'SELECT * FROM orders WHERE id = $1 AND partner_id = $2',
      [id, partnerId]
    );
    
    if (orderResult.rows.length === 0) {
      return sendErrorResponse(res, 404, 'Order not found or not assigned to you');
    }

    const order = orderResult.rows[0];
    const currentStatus = order.status;

    // Validate status transition
    const allowedTransitions = VALID_TRANSITIONS[currentStatus] || [];
    if (!allowedTransitions.includes(status)) {
      return sendErrorResponse(res, 400, 
        `Invalid status transition from ${currentStatus} to ${status}`,
        { allowed_transitions: allowedTransitions }
      );
    }

    // Update order status with transaction
    await executeTransaction(async (client) => {
      const updateResult = await client.query(
        `UPDATE orders SET status = $1, updated_at = now() WHERE id = $2 RETURNING *`,
        [status, id]
      );

      if (updateResult.rows.length === 0) {
        throw { status: 404, message: 'Order not found' };
      }

      return updateResult.rows[0];
    });

    // Trigger notifications based on status change (outside transaction)
    try {
      if (status === 'approved') {
        await createNotification(
          order.user_id,
          'order_update',
          'Order Confirmed',
          `Your order #${id} has been approved and is being prepared.`,
          id
        );
      } else if (status === 'out_for_delivery') {
        await createNotification(
          order.user_id,
          'order_update',
          'Order Out for Delivery',
          `Your order #${id} is out for delivery and will reach you soon.`,
          id
        );
      } else if (status === 'delivered_unverified') {
        await createNotification(
          order.user_id,
          'order_verification',
          'Confirm Delivery',
          `Did you receive your order #${id}? Please confirm to complete the order.`,
          id
        );
      } else if (status === 'fulfilled') {
        // Create partner payout record when order is fulfilled
        await db.query(
          `INSERT INTO partner_payouts (partner_id, order_id, amount, status)
           VALUES ($1, $2, $3, 'pending')
           ON CONFLICT (order_id) DO UPDATE SET amount = $3, status = 'pending'`,
          [partnerId, id, order.total || 0]
        );
      }
    } catch (notificationError) {
      console.error('Failed to send notification:', notificationError);
      // Don't fail the status update if notification fails
    }

    res.json({ success: true, message: 'Order status updated successfully' });
  } catch (err) {
    if (err.status) {
      return sendErrorResponse(res, err.status, err.message, err.details);
    }
    console.error('Error updating order status:', err);
    sendErrorResponse(res, 500, 'Failed to update order status', err.message);
  }
}

module.exports = {
  getAvailableOrders,
  acceptOrder,
  getPartnerOrders,
  updateOrderStatus,
};
