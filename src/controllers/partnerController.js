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

// Valid order status transitions for detailed lifecycle with sub-stages
const VALID_TRANSITIONS = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['in_progress', 'cancelled'],
  in_progress: ['in_progress', 'out_for_delivery', 'cancelled'],
  out_for_delivery: ['delivered', 'cancelled'],
  delivered: ['fulfilled', 'cancelled'],
  fulfilled: [],
  cancelled: [],
};

// Valid sub-status transitions for "in_progress" stage
const VALID_SUB_TRANSITIONS = {
  packed: ['ready_for_dispatch'],
  ready_for_dispatch: ['out_for_delivery'],
  out_for_delivery: ['delivered'],
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
  const partnerId = req.user?.id; // Use user ID from JWT
  try {
    // Get partner's type
    const partnerResult = await db.query(
      'SELECT partner_type FROM users WHERE id = $1 AND role = $2',
      [partnerId, 'vendor']
    );
    
    if (partnerResult.rows.length === 0) {
      return sendErrorResponse(res, 404, 'Partner not found');
    }
    
    const partnerType = partnerResult.rows[0].partner_type;
    
    // Get orders that are:
    // 1. In pending status
    // 2. Not yet assigned to any partner
    const result = await db.query(
      `SELECT DISTINCT o.*, u.name AS customer_name, u.phone AS customer_phone,
                a.line1, a.city, a.pincode, a.locality, a.latitude, a.longitude
         FROM orders o
         JOIN users u ON u.id = o.user_id
         JOIN addresses a ON a.id = o.address_id
         WHERE o.status = 'pending'
         AND o.partner_id IS NULL
         ORDER BY o.created_at ASC`
    );

    const orders = result.rows;
    for (const order of orders) {
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
  const partnerId = req.user?.id; // Use user ID from JWT

  if (!id) {
    return sendErrorResponse(res, 400, 'Order ID is required');
  }

  try {
    // Use transaction for atomic assignment
    const result = await executeTransaction(async (client) => {
      // Get partner details with lock
      const partnerResult = await client.query(
        'SELECT * FROM users WHERE id = $1 AND role = $2 FOR UPDATE',
        [partnerId, 'vendor']
      );
      
      if (partnerResult.rows.length === 0) {
        throw { status: 404, message: 'Partner not found' };
      }
      
      const partner = partnerResult.rows[0];

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
      if (order.status !== 'pending' || order.partner_id !== null) {
        throw { 
          status: 409, 
          message: 'Order is no longer available',
          details: { status: order.status, assigned_to: order.partner_id }
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
         SET partner_id = $1, status = 'confirmed', updated_at = now() 
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

// POST /api/partner/reject-order/:id
// Partner rejects an available order (reason: stock unavailability, etc.)
async function rejectOrder(req, res) {
  const { id } = req.params;
  const { reason } = req.body;
  const partnerId = req.user?.id;

  try {
    if (!partnerId) {
      return sendErrorResponse(res, 401, 'Unauthorized: Invalid partner ID');
    }

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // Check if order is still available
      const orderResult = await client.query(
        `SELECT * FROM orders WHERE id = $1 FOR UPDATE`,
        [id]
      );

      if (orderResult.rows.length === 0) {
        throw { status: 404, message: 'Order not found' };
      }

      const order = orderResult.rows[0];

      // Check if order is still available
      if (order.status !== 'pending' || order.partner_id !== null) {
        throw {
          status: 409,
          message: 'Order is no longer available',
          details: { status: order.status, assigned_to: order.partner_id }
        };
      }

      // Update order status to rejected
      const updateResult = await client.query(
        `UPDATE orders
         SET status = 'rejected', partner_id = $1, updated_at = now()
         WHERE id = $2
         RETURNING *`,
        [partnerId, id]
      );

      await client.query('COMMIT');

      // Send notification to customer
      try {
        const { createNotification } = require('./notificationController');
        await createNotification(
          order.user_id,
          'order_rejected',
          'Order Rejected',
          `Your order #${id} could not be fulfilled by the partner. Reason: ${reason || 'Not specified'}. Please try again later.`,
          id
        );
      } catch (notifError) {
        console.error('Failed to create rejection notification:', notifError);
      }

      res.json({
        success: true,
        order: updateResult.rows[0],
        message: 'Order rejected successfully'
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    if (err.status) {
      return sendErrorResponse(res, err.status, err.message, err.details);
    }
    console.error('Error rejecting order:', err);
    sendErrorResponse(res, 500, 'Failed to reject order', err.message);
  }
}

// GET /api/partner/orders
// Returns orders assigned to partner/vendor with items & Google Maps routing URL
async function getPartnerOrders(req, res) {
  const partnerId = req.user?.id; // Use user ID from JWT
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
// Updates order status with detailed lifecycle validation including sub-stages
async function updateOrderStatus(req, res) {
  const { id } = req.params;
  const { status, sub_status } = req.body;
  const partnerId = req.user?.id; // Use user ID from JWT

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

    // Validate sub-status transition if provided
    if (sub_status && status === 'in_progress') {
      const allowedSubTransitions = VALID_SUB_TRANSITIONS[order.sub_status] || [];
      if (!allowedSubTransitions.includes(sub_status)) {
        return sendErrorResponse(res, 400, 
          `Invalid sub-status transition from ${order.sub_status} to ${sub_status}`,
          { allowed_sub_transitions: allowedSubTransitions }
        );
      }
    }

    // Update order status with transaction
    await executeTransaction(async (client) => {
      const updateResult = await client.query(
        `UPDATE orders SET status = $1, sub_status = $2, updated_at = now() WHERE id = $3 RETURNING *`,
        [status, sub_status || null, id]
      );

      if (updateResult.rows.length === 0) {
        throw { status: 404, message: 'Order not found' };
      }

      return updateResult.rows[0];
    });

    res.json({ success: true, message: 'Order status updated successfully' });
  } catch (err) {
    if (err.status) {
      return sendErrorResponse(res, err.status, err.message, err.details);
    }
    console.error('Error updating order status:', err);
    sendErrorResponse(res, 500, 'Failed to update order status', err.message);
  }
}

// PATCH /api/partner/products/:id/stock
// Allows partner to mark product as out of stock (real-time sync to customer portal)
async function updateProductStock(req, res) {
  const { id } = req.params;
  const { stock, out_of_stock } = req.body;
  const partnerId = req.user?.id; // Use user ID from JWT

  if (!id) {
    return sendErrorResponse(res, 400, 'Product ID is required');
  }

  try {
    // Verify product belongs to this partner
    const productResult = await db.query(
      'SELECT * FROM products WHERE id = $1 AND partner_id = $2',
      [id, partnerId]
    );
    
    if (productResult.rows.length === 0) {
      return sendErrorResponse(res, 404, 'Product not found or not assigned to you');
    }

    const product = productResult.rows[0];

    // Update stock with transaction
    await executeTransaction(async (client) => {
      if (out_of_stock === true) {
        // Mark as out of stock
        await client.query(
          `UPDATE products SET stock = 0, is_active = false, updated_at = now() WHERE id = $1`,
          [id]
        );
      } else if (stock !== undefined) {
        // Update specific stock quantity
        await client.query(
          `UPDATE products SET stock = $1, is_active = $1 > 0, updated_at = now() WHERE id = $2`,
          [stock, id]
        );
      } else {
        throw { status: 400, message: 'Either stock or out_of_stock must be provided' };
      }
    });

    res.json({ 
      success: true, 
      message: 'Product stock updated successfully. Changes reflected in customer portal in real-time.' 
    });
  } catch (err) {
    if (err.status) {
      return sendErrorResponse(res, err.status, err.message, err.details);
    }
    console.error('Error updating product stock:', err);
    sendErrorResponse(res, 500, 'Failed to update product stock', err.message);
  }
}

module.exports = {
  getAvailableOrders,
  acceptOrder,
  rejectOrder,
  getPartnerOrders,
  updateOrderStatus,
  updateProductStock,
};
