const db = require('../config/db');

// GET /api/admin/orders
// Returns every order across all customers, most recent first — with
// customer contact info and line items, so the admin can act on each one.
async function listAllOrders(req, res) {
  const ordersResult = await db.query(
    `SELECT o.*, u.name AS customer_name, u.phone AS customer_phone, u.email AS customer_email,
            a.line1, a.city, a.pincode, a.recipient_name, a.delivery_instructions
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
    `UPDATE orders SET status = $1, updated_at = now() WHERE id = $2 RETURNING *`,
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

module.exports = { listAllOrders, updateOrderStatus, getStats };
