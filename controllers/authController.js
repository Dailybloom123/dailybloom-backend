const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { sendOtpSms } = require('../utils/sms');
const { sendOtpEmail } = require('../utils/email');

// In-memory OTP store for now — swap this for Redis before production,
// since this won't survive a server restart or work across multiple instances.
// Keyed by phone OR email, whichever the user logs in with.
const otpStore = new Map(); // identifier -> { otp, expiresAt }

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
}

// POST /api/auth/request-otp
// Body: { phone } OR { email } — send one or the other, not both.
async function requestOtp(req, res) {
  const { phone, email } = req.body;
  if (!phone && !email) {
    return res.status(400).json({ error: 'Phone or email is required' });
  }

  const identifier = phone || email;
  const otp = generateOtp();
  const expiresAt = Date.now() + (process.env.OTP_EXPIRY_MINUTES || 5) * 60 * 1000;
  otpStore.set(identifier, { otp, expiresAt });

  const result = phone ? await sendOtpSms(phone, otp) : await sendOtpEmail(email, otp);

  if (!result.delivered) {
    // Not a hard failure — OTP is still valid and usable, just check your
    // terminal for it (either the provider isn't configured yet, or the send failed).
    console.log(`Note: OTP not delivered via provider (${result.reason}). Still valid for testing.`);
  }

  res.json({ message: 'OTP sent successfully' });
}

// POST /api/auth/verify-otp
// Body: { phone, otp, name } OR { email, otp, name } — match whichever was used to request.
async function verifyOtp(req, res) {
  const { phone, email, otp, name } = req.body;
  if ((!phone && !email) || !otp) {
    return res.status(400).json({ error: 'Phone/email and OTP are required' });
  }

  const identifier = phone || email;
  const record = otpStore.get(identifier);
  if (!record || record.otp !== otp || Date.now() > record.expiresAt) {
    return res.status(401).json({ error: 'Invalid or expired OTP' });
  }
  otpStore.delete(identifier); // OTPs are single-use

  // Find or create the user, looking up by whichever identifier was used
  const lookupColumn = phone ? 'phone' : 'email';
  let result = await db.query(`SELECT * FROM users WHERE ${lookupColumn} = $1`, [identifier]);
  let user = result.rows[0];

  if (!user) {
    result = await db.query(
      `INSERT INTO users (${lookupColumn}, name) VALUES ($1, $2) RETURNING *`,
      [identifier, name || null]
    );
    user = result.rows[0];
  }

  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '30d',
  });

  res.json({ token, user });
}

module.exports = { requestOtp, verifyOtp };
