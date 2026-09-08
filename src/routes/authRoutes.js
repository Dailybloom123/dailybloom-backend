const express = require('express');
const router = express.Router();
const { 
  guestLogin, 
  register, 
  login, 
  requestOtp, 
  verifyOtp, 
  googleAuth, 
  googleCallback, 
  forgotPassword, 
  resetPassword,
  adminLogin,
  partnerLogin,
  getCurrentUser,
  changePassword,
  requestPasswordReset,
  resetPasswordWithOTP
} = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

// Guest login for users without accounts
router.post('/guest', guestLogin);

// Traditional email/password authentication
router.post('/register', register);
router.post('/login', login);

// OTP-based authentication (Email or Phone)
router.post('/request-otp', requestOtp);
router.post('/verify-otp', verifyOtp);

// Google OAuth
router.post('/google', googleAuth);
router.get('/google/callback', googleCallback);

// Password reset
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// Admin and Partner Login (New)
router.post('/admin/login', adminLogin);
router.post('/partner/login', partnerLogin);

// Password Management (New)
router.post('/change-password', authenticate, changePassword);
router.post('/request-password-reset', requestPasswordReset);
router.post('/reset-password-with-otp', resetPasswordWithOTP);

// Get current user (protected)
router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;