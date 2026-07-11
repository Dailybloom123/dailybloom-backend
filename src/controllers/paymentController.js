const crypto = require('crypto');
const db = require('../config/db');
const razorpay = require('../utils/razorpay');
const { notifyAdminWhatsApp } = require('../utils/whatsapp');

// POST /api/payments/create
// Body: { address_id, delivery_date, delivery_slot, items: [{ product_id, quantity }] }
//
// This creates a Razorpay order AND a matching row in our own `orders` table
// with payment_status = 'pending' — the order exists, but isn't confirmed
// until the customer actually pays and we verify it below.
async function createPaymentOrder(req, res) {
  const userId = req.userId;
  const { address_id, delivery_date, delivery_slot, items } = req.body;

  if (!address_id || !delivery_date || !items || items.length === 0) {
    return res.status(400).json({ error: 'address_id, delivery_date, and items are required' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const addrResult = await client.query('SELECT * FROM addresses WHERE id = $1 AND user_id = $2', [address_id, userId]);
    if (addrResult.rows.length === 0) throw { status: 404, message: 'Address not found' };
    const zoneId = addrResult.rows[0].zone_id;

    // Always recalculate the price from the database — never trust a client-sent amount.
    const productIds = items.map((i) => i.product_id);
    const productsResult = await client.query('SELECT id, price FROM products WHERE id = ANY($1)', [productIds]);
    const priceMap = new Map(productsResult.rows.map((p) => [p.id, parseFloat(p.price)]));

    let total = 0;
    for (const item of items) {
      const price = priceMap.get(item.product_id);
      if (price === undefined) throw { status: 400, message: `Product ${item.product_id} not found` };
      total += price * item.quantity;
    }

    // Razorpay expects amounts in the smallest currency unit — paise for INR, so ₹120 becomes 12000.
    const amountInPaise = Math.round(total * 100);

    const razorpayOrder = await razorpay.orders.create({
      amount: amountInPaise,
      currency: 'INR',
      receipt: `dailybloom_${Date.now()}`,
    });

    const orderResult = await client.query(
      `INSERT INTO orders (user_id, address_id, zone_id, status, total, delivery_date, delivery_slot, razorpay_order_id, payment_status)
       VALUES ($1, $2, $3, 'placed', $4, $5, $6, $7, 'pending') RETURNING *`,
      [userId, address_id, zoneId, total, delivery_date, delivery_slot || null, razorpayOrder.id]
    );
    const order = orderResult.rows[0];

    for (const item of items) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, quantity, price) VALUES ($1, $2, $3, $4)`,
        [order.id, item.product_id, item.quantity, priceMap.get(item.product_id)]
      );
    }

    await client.query('COMMIT');

    res.status(201).json({
      order_id: order.id,
      razorpay_order_id: razorpayOrder.id,
      amount: amountInPaise,
      currency: 'INR',
      key_id: process.env.RAZORPAY_KEY_ID, // safe to expose — this is the public key, not the secret
    });
  } catch (err) {
    await client.query('ROLLBACK');
    const status = err.status || 500;
    res.status(status).json({ error: err.message || 'Failed to create payment order' });
  } finally {
    client.release();
  }
}

// POST /api/payments/verify
// Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
//
// Called by the frontend right after Razorpay's checkout popup reports success.
// We independently verify the signature here — never trust "it succeeded" from
// the frontend alone, since that could be faked or the connection could drop.
async function verifyPayment(req, res) {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ error: 'Missing payment verification fields' });
  }

  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  if (expectedSignature !== razorpay_signature) {
    return res.status(400).json({ error: 'Payment signature verification failed' });
  }

  const result = await db.query(
    `UPDATE orders SET payment_status = 'paid', razorpay_payment_id = $1, updated_at = now()
     WHERE razorpay_order_id = $2 RETURNING *`,
    [razorpay_payment_id, razorpay_order_id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Order not found for this payment' });
  }

  const order = result.rows[0];

  notifyAdminWhatsApp(`Payment received! Order Rs.${parseFloat(order.total).toFixed(0)} is now paid.`)
    .catch((e) => console.error('WhatsApp notify error:', e.message));

  res.json(order);
}

module.exports = { createPaymentOrder, verifyPayment };
