const db = require('../config/db');
const { notifyAdminWhatsApp } = require('../utils/whatsapp');

// POST /api/orders
// Body: { address_id, delivery_date, delivery_slot, items: [{ product_id, quantity }] }
// Creates a one-time order (not tied to a subscription).
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

    // Fetch current prices for all requested products (never trust client-sent prices)
    const productIds = items.map((i) => i.product_id);
    const productsResult = await client.query('SELECT id, name, price FROM products WHERE id = ANY($1)', [productIds]);
    const priceMap = new Map(productsResult.rows.map((p) => [p.id, parseFloat(p.price)]));
    const nameMap = new Map(productsResult.rows.map((p) => [p.id, p.name]));

    let total = 0;
    for (const item of items) {
      const price = priceMap.get(item.product_id);
      if (price === undefined) throw { status: 400, message: `Product ${item.product_id} not found` };
      total += price * item.quantity;
    }

    const orderResult = await client.query(
      `INSERT INTO orders (user_id, address_id, zone_id, status, total, delivery_date, delivery_slot)
       VALUES ($1, $2, $3, 'placed', $4, $5, $6) RETURNING *`,
      [userId, address_id, zoneId, total, delivery_date, delivery_slot || null]
    );
    const order = orderResult.rows[0];

    for (const item of items) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, quantity, price) VALUES ($1, $2, $3, $4)`,
        [order.id, item.product_id, item.quantity, priceMap.get(item.product_id)]
      );
    }

    await client.query('COMMIT');

    // Notify admin via WhatsApp — fire-and-forget, doesn't block the response
    // to the customer if the notification itself is slow or fails.
    const itemsSummary = items.map((i) => `${nameMap.get(i.product_id)} x${i.quantity}`).join(', ');
    notifyAdminWhatsApp(
      `🔔 New DailyBloom order!\n₹${total.toFixed(0)} — ${itemsSummary}\nDelivery: ${delivery_date} (${delivery_slot || 'any time'})`
    ).catch((e) => console.error('WhatsApp notify error:', e.message));

    res.status(201).json(order);
  } catch (err) {
    await client.query('ROLLBACK');
    const status = err.status || 500;

    // Also notify on failures — so you know if customers are hitting errors
    // while trying to order, even though nothing was actually charged/created.
    notifyAdminWhatsApp(
      `⚠️ DailyBloom order FAILED for a customer.\nReason: ${err.message || 'Unknown error'}`
    ).catch((e) => console.error('WhatsApp notify error:', e.message));

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

module.exports = { createOrder, listOrders, getOrder };
