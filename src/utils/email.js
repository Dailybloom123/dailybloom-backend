// Sends OTP codes via email using Resend (resend.com).
// This is a fallback/alternative to SMS while MSG91's DLT template is pending approval.
//
// Setup required:
//   1. Sign up at resend.com, create an API key
//   2. Add RESEND_API_KEY to your .env
//
// Note: on Resend's free/unverified-domain tier, you can only send to the
// email address you signed up with. Verify a domain later to send to anyone.

const apiKey = process.env.RESEND_API_KEY;
const fromEmail = process.env.RESEND_FROM_EMAIL || 'DailyBloom <onboarding@resend.dev>';

async function sendOtpEmail(email, otp) {
  if (!apiKey) {
    console.log(`[DEV ONLY - Resend not configured] OTP for ${email}: ${otp}`);
    return { delivered: false, reason: 'Resend not configured' };
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [email],
      subject: 'Your DailyBloom login code',
      html: `<p>Your DailyBloom OTP is <strong>${otp}</strong>. It expires in ${process.env.OTP_EXPIRY_MINUTES || 5} minutes.</p>`,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error('Resend send failed:', data);
    console.log(`[FALLBACK] OTP for ${email}: ${otp}`);
    return { delivered: false, reason: data.message || 'Resend request failed' };
  }

  return { delivered: true };
}

async function sendOrderConfirmationEmail(email, orderDetails) {
  if (!apiKey) {
    console.log(`[DEV ONLY - Resend not configured] Order confirmation for ${email}`);
    return { delivered: false, reason: 'Resend not configured' };
  }

  const { orderId, total, deliveryDate, items } = orderDetails;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [email],
      subject: `Order Confirmation - Order #${orderId.slice(0, 8)}`,
      html: `
        <h2>Order Confirmed!</h2>
        <p>Thank you for your order. Your order #${orderId.slice(0, 8)} has been confirmed.</p>
        <p><strong>Total:</strong> ₹${total}</p>
        <p><strong>Delivery Date:</strong> ${new Date(deliveryDate).toLocaleDateString()}</p>
        <h3>Order Items:</h3>
        <ul>
          ${items.map(item => `<li>${item.name} x ${item.quantity} - ₹${item.price * item.quantity}</li>`).join('')}
        </ul>
        <p>You can track your order status in the DailyBloom app.</p>
      `,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error('Resend send failed:', data);
    return { delivered: false, reason: data.message || 'Resend request failed' };
  }

  return { delivered: true };
}

async function sendDeliveryUpdateEmail(email, orderDetails) {
  if (!apiKey) {
    console.log(`[DEV ONLY - Resend not configured] Delivery update for ${email}`);
    return { delivered: false, reason: 'Resend not configured' };
  }

  const { orderId, status, deliveryDate } = orderDetails;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [email],
      subject: `Order Update - Order #${orderId.slice(0, 8)}`,
      html: `
        <h2>Order Status Update</h2>
        <p>Your order #${orderId.slice(0, 8)} status has been updated to: <strong>${status}</strong></p>
        ${deliveryDate ? `<p><strong>Expected Delivery:</strong> ${new Date(deliveryDate).toLocaleDateString()}</p>` : ''}
        <p>You can track your order status in the DailyBloom app.</p>
      `,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error('Resend send failed:', data);
    return { delivered: false, reason: data.message || 'Resend request failed' };
  }

  return { delivered: true };
}

async function sendVerificationEmail(email, verificationToken) {
  if (!apiKey) {
    console.log(`[DEV ONLY - Resend not configured] Verification email for ${email}`);
    return { delivered: false, reason: 'Resend not configured' };
  }

  const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [email],
      subject: 'Verify your DailyBloom email',
      html: `
        <h2>Verify Your Email</h2>
        <p>Please click the link below to verify your email address:</p>
        <p><a href="${verificationUrl}">Verify Email</a></p>
        <p>This link will expire in 24 hours.</p>
      `,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error('Resend send failed:', data);
    return { delivered: false, reason: data.message || 'Resend request failed' };
  }

  return { delivered: true };
}

module.exports = { 
  sendOtpEmail,
  sendOrderConfirmationEmail,
  sendDeliveryUpdateEmail,
  sendVerificationEmail
};
