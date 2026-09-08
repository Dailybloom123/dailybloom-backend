const db = require('../config/db');
const { createNotification } = require('./notificationController');
const { sendWhatsAppOrder, sendWhatsAppConfirmation } = require('../utils/whatsapp');

// POST /api/orders
// Body: { address_id, delivery_date, delivery_slot, items: [{ product_id, quantity }] }
// Creates a one-time order (not tied to a subscription).
// Implements stock reservation with race condition prevention using database transactions.
async function createOrder(req, res) {
  const userId = req.userId;
  const { address_id, delivery_date, delivery_slot, items } = req.body;

  if (!address_id || !delivery_date || !items || items.length === 0) {
    return res.status(400).json({ error: 'address_id, delivery_date, and items are required' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Look up the address to find its zone
    const addrResult = await client.query('SELECT * FROM addresses WHERE id = $1 AND user_id = $2', [address_id, userId]);
    if (addrResult.rows.length === 0) throw { status: 404, message: 'Address not found' };
    const zoneId = addrResult.rows[0].zone_id;

    // Fetch current prices and stock for all requested products
    const productIds = items.map((i) => i.product_id);
    const productsResult = await client.query(
      `SELECT id, price, stock, stock_reserved FROM products WHERE id = ANY($1) FOR UPDATE`,
      [productIds]
    );
    const productMap = new Map(productsResult.rows.map((p) => [p.id, p]));

    let total = 0;
    const outOfStockItems = [];

    for (const item of items) {
      const product = productMap.get(item.product_id);
      if (!product) throw { status: 400, message: `Product ${item.product_id} not found` };

      const availableStock = product.stock - product.stock_reserved;
      if (availableStock < item.quantity) {
        outOfStockItems.push({
          product_id: item.product_id,
          requested: item.quantity,
          available: availableStock
        });
      }

      total += parseFloat(product.price) * item.quantity;
    }

    // If any items are out of stock, rollback and return error
    if (outOfStockItems.length > 0) {
      await client.query('ROLLBACK');
      
      // Send notification to user about out of stock items
      for (const item of outOfStockItems) {
        const product = productMap.get(item.product_id);
        await createNotification(
          userId,
          'out_of_stock',
          'Item Out of Stock',
          `Sorry, ${product.name} is currently out of stock. Only ${item.available} available, but you requested ${item.requested}.`,
          null,
          item.product_id
        );
      }
      
      return res.status(400).json({
        error: 'Some items are out of stock',
        out_of_stock_items: outOfStockItems
      });
    }

    // Create the order with PENDING status (new 5-state lifecycle)
    const orderResult = await client.query(
      `INSERT INTO orders (user_id, address_id, zone_id, status, total, delivery_date, delivery_slot)
       VALUES ($1, $2, $3, 'pending', $4, $5, $6) RETURNING *`,
      [userId, address_id, zoneId, total, delivery_date, delivery_slot || null]
    );
    const order = orderResult.rows[0];

    // Add order items and reserve stock
    for (const item of items) {
      const product = productMap.get(item.product_id);
      
      await client.query(
        `INSERT INTO order_items (order_id, product_id, quantity, price) VALUES ($1, $2, $3, $4)`,
        [order.id, item.product_id, item.quantity, parseFloat(product.price)]
      );

      // Reserve stock atomically
      await client.query(
        `UPDATE products SET stock_reserved = stock_reserved + $1 WHERE id = $2`,
        [item.quantity, item.product_id]
      );
    }

    await client.query('COMMIT');
    
    // Send WhatsApp notification if configured
    try {
      const userResult = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
      const user = userResult.rows[0];
      
      if (user.phone) {
        const orderDetails = {
          orderId: order.id,
          customerName: user.name || 'Customer',
          items: items.map(item => ({
            name: productMap.get(item.product_id).name,
            quantity: item.quantity,
            price: parseFloat(productMap.get(item.product_id).price)
          })),
          total: total,
          address: addrResult.rows[0]
        };
        
        await sendWhatsAppOrder(user.phone, orderDetails);
      }
    } catch (whatsappError) {
      console.error('WhatsApp notification failed:', whatsappError);
      // Don't fail the order if WhatsApp fails
    }
    
    res.status(201).json(order);
  } catch (err) {
    await client.query('ROLLBACK');
    const status = err.status || 500;
    res.status(status).json({ error: err.message || 'Failed to create order' });
  } finally {
    client.release();
  }
}

// GET /api/orders
// Returns the logged-in user's order history, most recent first.
async function listOrders(req, res) {
  const userId = req.userId;
  const ordersResult = await db.query(
    `SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  );

  // Attach line items to each order
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

// GET /api/orders/:id
async function getOrder(req, res) {
  const userId = req.userId;
  const { id } = req.params;

  const orderResult = await db.query('SELECT * FROM orders WHERE id = $1 AND user_id = $2', [id, userId]);
  if (orderResult.rows.length === 0) return res.status(404).json({ error: 'Order not found' });

  const order = orderResult.rows[0];
  const itemsResult = await db.query(
    `SELECT oi.*, p.name AS product_name FROM order_items oi
     JOIN products p ON p.id = oi.product_id WHERE oi.order_id = $1`,
    [id]
  );
  order.items = itemsResult.rows;

  res.json(order);
}

// POST /api/orders/:id/confirm-stock
// Called when payment is confirmed to move stock from reserved to actual deduction
async function confirmOrderStock(req, res) {
  const { id } = req.params;
  const userId = req.userId;

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Verify order belongs to user
    const orderResult = await client.query(
      'SELECT * FROM orders WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    if (orderResult.rows.length === 0) throw { status: 404, message: 'Order not found' };
    const order = orderResult.rows[0];

    // Get order items
    const itemsResult = await client.query(
      'SELECT product_id, quantity FROM order_items WHERE order_id = $1',
      [id]
    );

    // Deduct stock from reserved and actual stock
    for (const item of itemsResult.rows) {
      await client.query(
        `UPDATE products 
         SET stock = stock - $1, stock_reserved = stock_reserved - $1 
         WHERE id = $2`,
        [item.quantity, item.product_id]
      );
    }

    await client.query('COMMIT');
    res.json({ message: 'Stock confirmed and deducted' });
  } catch (err) {
    await client.query('ROLLBACK');
    const status = err.status || 500;
    res.status(status).json({ error: err.message || 'Failed to confirm stock' });
  } finally {
    client.release();
  }
}

// POST /api/orders/:id/release-stock
// Called when order is cancelled to release reserved stock back to available
async function releaseOrderStock(req, res) {
  const { id } = req.params;

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Get order items
    const itemsResult = await client.query(
      'SELECT product_id, quantity FROM order_items WHERE order_id = $1',
      [id]
    );

    // Release reserved stock back to available
    for (const item of itemsResult.rows) {
      await client.query(
        `UPDATE products SET stock_reserved = stock_reserved - $1 WHERE id = $2`,
        [item.quantity, item.product_id]
      );
    }

    await client.query('COMMIT');
    res.json({ message: 'Stock released' });
  } catch (err) {
    await client.query('ROLLBACK');
    const status = err.status || 500;
    res.status(status).json({ error: err.message || 'Failed to release stock' });
  } finally {
    client.release();
  }
}

// DELETE /api/orders/:id
// Cancel an order - only allowed if status is 'placed' or 'confirmed'
async function cancelOrder(req, res) {
  const { id } = req.params;
  const userId = req.userId;

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Get the order and verify it belongs to the user
    const orderResult = await client.query(
      'SELECT * FROM orders WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    if (orderResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Order not found' });
    }
    const order = orderResult.rows[0];

    // Check if order can be cancelled (updated for 5-state lifecycle)
    if (order.status !== 'pending' && order.status !== 'approved') {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        error: 'Order cannot be cancelled. Orders can only be cancelled while in "pending" or "approved" status.',
        current_status: order.status 
      });
    }

    // Update order status to cancelled
    await client.query(
      'UPDATE orders SET status = $1 WHERE id = $2',
      ['cancelled', id]
    );

    // Release reserved stock
    const itemsResult = await client.query(
      'SELECT product_id, quantity FROM order_items WHERE order_id = $1',
      [id]
    );

    // Send WhatsApp cancellation notification
    try {
      const userResult = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
      const user = userResult.rows[0];
      
      if (user.phone) {
        await sendWhatsAppConfirmation(user.phone, id, 'cancelled');
      }
    } catch (whatsappError) {
      console.error('WhatsApp cancellation notification failed:', whatsappError);
    }

    for (const item of itemsResult.rows) {
      await client.query(
        `UPDATE products SET stock_reserved = stock_reserved - $1 WHERE id = $2`,
        [item.quantity, item.product_id]
      );
    }

    await client.query('COMMIT');

    // Create automatic refund request
    try {
      await db.query(
        `INSERT INTO refunds (order_id, user_id, amount, reason, status)
         VALUES ($1, $2, $3, 'Order cancelled by customer', 'pending')`,
        [id, userId, order.total]
      );
    } catch (refundError) {
      console.error('Failed to create refund request:', refundError);
      // Don't fail the cancellation if refund creation fails
    }

    // Notify user about cancellation and refund
    await createNotification(
      userId,
      'order_update',
      'Order Cancelled',
      `Your order has been cancelled. A refund of ₹${parseFloat(order.total).toFixed(0)} has been initiated and will be processed within 5-7 business days.`,
      id
    );

    res.json({ message: 'Order cancelled successfully. Refund initiated.', order_id: id });
  } catch (err) {
    await client.query('ROLLBACK');
    const status = err.status || 500;
    res.status(status).json({ error: err.message || 'Failed to cancel order' });
  } finally {
    client.release();
  }
}

// PATCH /api/orders/:id/verify-delivery
// Customer confirms delivery - transitions from delivered_unverified to fulfilled
async function verifyOrderDelivery(req, res) {
  const { id } = req.params;
  const { confirmed } = req.body;
  const userId = req.userId;

  if (confirmed === undefined) {
    return res.status(400).json({ error: 'Confirmation status is required' });
  }

  try {
    // Get order and verify it belongs to user
    const orderResult = await db.query(
      'SELECT * FROM orders WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orderResult.rows[0];

    // Only allow verification if order is in delivered_unverified status
    if (order.status !== 'delivered_unverified') {
      return res.status(400).json({ 
        error: 'Order can only be verified when in delivered_unverified status',
        current_status: order.status 
      });
    }

    if (confirmed) {
      // Customer confirmed delivery - transition to fulfilled
      const updateResult = await db.query(
        `UPDATE orders SET status = 'fulfilled', updated_at = now() WHERE id = $1 RETURNING *`,
        [id]
      );

      const updatedOrder = updateResult.rows[0];

      // Create partner payout record
      await db.query(
        `INSERT INTO partner_payouts (partner_id, order_id, amount, status)
         VALUES ($1, $2, $3, 'pending')
         ON CONFLICT (order_id) DO UPDATE SET amount = $3, status = 'pending'`,
        [order.partner_id || 1, id, order.total || 0]
      );

      // Notify customer
      await createNotification(
        userId,
        'order_update',
        'Order Fulfilled',
        `Thank you for confirming! Your order #${id} has been marked as fulfilled.`,
        id
      );

      res.json({ success: true, order: updatedOrder });
    } else {
      // Customer did not receive - create support ticket
      await db.query(
        `INSERT INTO feedback (order_id, user_id, issue, status)
         VALUES ($1, $2, 'Customer reported not received', 'open')`,
        [id, userId]
      );

      // Notify admin
      await createNotification(
        userId,
        'order_update',
        'Delivery Issue Reported',
        `We're sorry you didn't receive your order. Our team will investigate and get back to you shortly.`,
        id
      );

      res.json({ success: true, message: 'Issue reported. Our team will investigate.' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { createOrder, listOrders, getOrder, confirmOrderStock, releaseOrderStock, cancelOrder, verifyOrderDelivery };
