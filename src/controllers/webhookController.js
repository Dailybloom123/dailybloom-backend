const crypto = require('crypto');
const db = require('../config/db');
const { notifyAdminWhatsApp } = require('../utils/whatsapp');

// POST /api/webhooks/razorpay
//
// This is called directly by Razorpay's servers (not the customer's browser) —
// it's the most reliable source of truth for "did this payment actually succeed,"
// since it doesn't depend on the customer's app staying open or their connection
// staying alive after paying.
//
// Setup required: in your Razorpay dashboard, under Settings > Webhooks, add
// this endpoint's full URL and set a webhook secret, then put that secret in
// RAZORPAY_WEBHOOK_SECRET in your .env.
async function handleRazorpayWebhook(req, res) {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.log('Razorpay webhook received but RAZORPAY_WEBHOOK_SECRET is not set — skipping verification.');
    return res.status(200).json({ received: true, note: 'webhook secret not configured' });
  }

  // req.body is a raw Buffer here (see app.js), required for signature verification.
  const rawBody = req.body;
  const signature = req.headers['x-razorpay-signature'];

  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(rawBody)
    .digest('hex');

  if (signature !== expectedSignature) {
    console.error('Razorpay webhook signature mismatch — rejecting.');
    return res.status(400).json({ error: 'Invalid webhook signature' });
  }

  const event = JSON.parse(rawBody.toString());

  if (event.event === 'payment.captured') {
    const payment = event.payload.payment.entity;
    const razorpayOrderId = payment.order_id;
    const paymentId = payment.id;

    // Idempotent: only update if not already marked paid, so a duplicate
    // webhook delivery (which Razorpay may occasionally send) doesn't cause issues.
    const result = await db.query(
      `UPDATE orders SET payment_status = 'paid', razorpay_payment_id = $1, updated_at = now()
       WHERE razorpay_order_id = $2 AND payment_status != 'paid' RETURNING *`,
      [paymentId, razorpayOrderId]
    );

    if (result.rows.length > 0) {
      const order = result.rows[0];
      notifyAdminWhatsApp(`Payment confirmed via webhook! Order Rs.${parseFloat(order.total).toFixed(0)} is paid.`)
        .catch((e) => console.error('WhatsApp notify error:', e.message));
    }
  }

  if (event.event === 'payment.failed') {
    const payment = event.payload.payment.entity;
    await db.query(
      `UPDATE orders SET payment_status = 'failed', updated_at = now() WHERE razorpay_order_id = $1`,
      [payment.order_id]
    );
  }

  // Always respond 200 quickly so Razorpay doesn't keep retrying unnecessarily.
  res.status(200).json({ received: true });
}

module.exports = { handleRazorpayWebhook };
