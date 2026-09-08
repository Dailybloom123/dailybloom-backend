// Sends OTP codes via email using Resend (resend.com).
// This is a fallback/alternative to SMS while MSG91's DLT template is pending approval.
//
// Setup required:
//   1. Sign up at resend.com, create an API key
//   2. Add RESEND_API_KEY to your .env
//
// Note: on Resend's free/unverified-domain tier, you can only send to the
// email address you signed up with. Verify a domain later to send to anyone.

async function sendOtpEmail(email, otp) {
  const apiKey = process.env.RESEND_API_KEY;

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
      from: 'DailyBloom <onboarding@resend.dev>', // Resend's shared sandbox sender - fine for testing
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

module.exports = { sendOtpEmail };
