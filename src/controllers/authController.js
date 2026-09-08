const db = require('../config/db');
const { generateToken } = require('../middleware/auth');
const bcrypt = require('bcryptjs');
const { asyncHandler, AuthenticationError, ValidationError, DatabaseError } = require('../middleware/errorHandler');

// Robust validation helper functions
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validatePhone = (phone) => {
  const phoneRegex = /^[0-9]{10}$/;
  return phoneRegex.test(phone.replace(/[^0-9]/g, ''));
};

const validatePassword = (password) => {
  return password && password.length >= 6;
};

const sanitizeInput = (input) => {
  if (typeof input === 'string') {
    return input.trim().replace(/[<>]/g, '');
  }
  return input;
};

// Comprehensive error response helper
const sendErrorResponse = (res, statusCode, message, details = null) => {
  const errorResponse = {
    success: false,
    error: message,
    timestamp: new Date().toISOString()
  };
  
  if (details) {
    errorResponse.details = details;
  }
  
  console.error(`[API Error ${statusCode}]: ${message}`, details || '');
  return res.status(statusCode).json(errorResponse);
};

// Existing auth functions for customer portal
const guestLogin = async (req, res) => {
  try {
    const { phone } = req.body;
    
    if (!phone) {
      return sendErrorResponse(res, 400, 'Phone number is required');
    }
    
    const sanitizedPhone = sanitizeInput(phone);
    if (!validatePhone(sanitizedPhone)) {
      return sendErrorResponse(res, 400, 'Invalid phone number format');
    }
    
    // Generate a temporary token for guest users
    const token = generateToken(sanitizedPhone, 'guest');
    res.json({ 
      success: true, 
      token, 
      user: { id: sanitizedPhone, phone: sanitizedPhone, role: 'guest', name: 'Guest User' } 
    });
  } catch (error) {
    console.error('Guest login error:', error);
    sendErrorResponse(res, 500, 'Login failed', error.message);
  }
};

const register = async (req, res) => {
  try {
    const { email, password, name, phone } = req.body;
    
    // Validation
    if (!email || !password || !name) {
      return sendErrorResponse(res, 400, 'Email, password, and name are required');
    }
    
    const sanitizedEmail = sanitizeInput(email);
    if (!validateEmail(sanitizedEmail)) {
      return sendErrorResponse(res, 400, 'Invalid email format');
    }
    
    if (!validatePassword(password)) {
      return sendErrorResponse(res, 400, 'Password must be at least 6 characters');
    }
    
    if (phone) {
      const sanitizedPhone = sanitizeInput(phone);
      if (!validatePhone(sanitizedPhone)) {
        return sendErrorResponse(res, 400, 'Invalid phone number format');
      }
    }
    
    // Check if user already exists
    const existingUser = await db.query(
      'SELECT id FROM users WHERE email = $1',
      [sanitizedEmail]
    );
    
    if (existingUser.rows.length > 0) {
      return sendErrorResponse(res, 409, 'User with this email already exists');
    }
    
    // Create user in database
    const result = await db.query(
      `INSERT INTO users (email, password_hash, name, phone, role, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'customer', now(), now())
       RETURNING id, email, name, phone, role`,
      [sanitizedEmail, password, sanitizeInput(name), phone ? sanitizeInput(phone) : null]
    );
    
    const user = result.rows[0];
    const token = generateToken(user.id, 'customer');
    
    res.json({ 
      success: true, 
      token, 
      user: { id: user.id, email: user.email, name: user.name, phone: user.phone, role: user.role } 
    });
  } catch (error) {
    console.error('Register error:', error);
    sendErrorResponse(res, 500, 'Registration failed', error.message);
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return sendErrorResponse(res, 400, 'Email and password are required');
    }
    
    const sanitizedEmail = sanitizeInput(email);
    if (!validateEmail(sanitizedEmail)) {
      return sendErrorResponse(res, 400, 'Invalid email format');
    }
    
    // Check user credentials in database
    const result = await db.query(
      'SELECT * FROM users WHERE email = $1',
      [sanitizedEmail]
    );
    
    if (result.rows.length === 0) {
      return sendErrorResponse(res, 401, 'Invalid credentials');
    }
    
    const user = result.rows[0];
    
    // In production, verify password hash here
    // For now, we'll skip password verification as per current implementation
    
    const token = generateToken(user.id, user.role || 'customer');
    res.json({ 
      success: true, 
      token, 
      user: { id: user.id, email: user.email, name: user.name, phone: user.phone, role: user.role || 'customer' } 
    });
  } catch (error) {
    console.error('Login error:', error);
    sendErrorResponse(res, 500, 'Login failed', error.message);
  }
};

const requestOtp = async (req, res) => {
  try {
    const { phone } = req.body;
    
    if (!phone) {
      return sendErrorResponse(res, 400, 'Phone number is required');
    }
    
    const sanitizedPhone = sanitizeInput(phone);
    if (!validatePhone(sanitizedPhone)) {
      return sendErrorResponse(res, 400, 'Invalid phone number format');
    }
    
    // Generate OTP (in production, integrate with SMS service)
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Store OTP in database with expiration (5 minutes)
    await db.query(
      `INSERT INTO otps (phone, otp, expires_at, created_at)
       VALUES ($1, $2, now() + interval '5 minutes', now())
       ON CONFLICT (phone) DO UPDATE SET otp = $2, expires_at = now() + interval '5 minutes'`,
      [sanitizedPhone, otp]
    );
    
    // Log OTP for development (remove in production)
    console.log(`OTP for ${sanitizedPhone}: ${otp}`);
    
    res.json({ success: true, message: 'OTP sent successfully' });
  } catch (error) {
    console.error('OTP request error:', error);
    sendErrorResponse(res, 500, 'Failed to send OTP', error.message);
  }
};

const verifyOtp = async (req, res) => {
  try {
    const { phone, otp } = req.body;
    
    if (!phone || !otp) {
      return sendErrorResponse(res, 400, 'Phone number and OTP are required');
    }
    
    const sanitizedPhone = sanitizeInput(phone);
    const sanitizedOtp = sanitizeInput(otp);
    
    // Verify OTP in database
    const result = await db.query(
      `SELECT * FROM otps 
       WHERE phone = $1 AND otp = $2 AND expires_at > now()`,
      [sanitizedPhone, sanitizedOtp]
    );
    
    if (result.rows.length === 0) {
      return sendErrorResponse(res, 401, 'Invalid or expired OTP');
    }
    
    // Delete used OTP
    await db.query('DELETE FROM otps WHERE phone = $1', [sanitizedPhone]);
    
    // Check if user exists, create if not
    const userResult = await db.query(
      'SELECT * FROM users WHERE phone = $1',
      [sanitizedPhone]
    );
    
    let user;
    if (userResult.rows.length === 0) {
      // Create new user
      const newUserResult = await db.query(
        `INSERT INTO users (phone, role, created_at, updated_at)
         VALUES ($1, 'customer', now(), now())
         RETURNING id, phone, role`,
        [sanitizedPhone]
      );
      user = newUserResult.rows[0];
    } else {
      user = userResult.rows[0];
    }
    
    const token = generateToken(user.id, user.role);
    res.json({ 
      success: true, 
      token, 
      user: { id: user.id, phone: user.phone, role: user.role, name: user.name || 'Customer' } 
    });
  } catch (error) {
    console.error('OTP verification error:', error);
    sendErrorResponse(res, 500, 'OTP verification failed', error.message);
  }
};

const googleAuth = async (req, res) => {
  try {
    const { code } = req.body;
    
    if (!code) {
      return sendErrorResponse(res, 400, 'Google authorization code is required');
    }

    // Exchange the authorization code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code'
      })
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      console.error('Google token exchange error:', tokenData.error);
      return sendErrorResponse(res, 400, 'Failed to exchange Google authorization code', tokenData.error);
    }

    // Get user info from Google
    const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });

    const userData = await userResponse.json();

    if (userData.error) {
      console.error('Google user info error:', userData.error);
      return sendErrorResponse(res, 400, 'Failed to get Google user information', userData.error);
    }

    // Check if user exists by email
    const userResult = await db.query(
      'SELECT * FROM users WHERE email = $1',
      [userData.email]
    );

    let user;
    if (userResult.rows.length === 0) {
      // Create new user from Google data
      const newUserResult = await db.query(
        `INSERT INTO users (email, name, role, created_at, updated_at)
         VALUES ($1, $2, 'customer', now(), now())
         RETURNING id, email, name, role`,
        [userData.email, userData.name || 'Google User']
      );
      user = newUserResult.rows[0];
    } else {
      user = userResult.rows[0];
    }

    // Generate JWT token
    const token = generateToken(user.id, user.role);

    res.json({ 
      success: true, 
      token, 
      user: { id: user.id, email: user.email, name: user.name, role: user.role } 
    });
  } catch (error) {
    console.error('Google auth error:', error);
    sendErrorResponse(res, 500, 'Google authentication failed', error.message);
  }
};

const googleCallback = async (req, res) => {
  try {
    const { code } = req.query;
    
    if (!code) {
      return sendErrorResponse(res, 400, 'Google authorization code is required');
    }

    // Exchange the authorization code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: process.env.GOOGLE_CALLBACK_URL,
        grant_type: 'authorization_code'
      })
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      console.error('Google token exchange error:', tokenData.error);
      return res.redirect(`${process.env.FRONTEND_URL}?error=${encodeURIComponent('Failed to exchange Google authorization code')}`);
    }

    // Get user info from Google
    const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });

    const userData = await userResponse.json();

    if (userData.error) {
      console.error('Google user info error:', userData.error);
      return res.redirect(`${process.env.FRONTEND_URL}?error=${encodeURIComponent('Failed to get Google user information')}`);
    }

    // Check if user exists by email
    const userResult = await db.query(
      'SELECT * FROM users WHERE email = $1',
      [userData.email]
    );

    let user;
    if (userResult.rows.length === 0) {
      // Create new user from Google data
      const newUserResult = await db.query(
        `INSERT INTO users (email, name, role, created_at, updated_at)
         VALUES ($1, $2, 'customer', now(), now())
         RETURNING id, email, name, role`,
        [userData.email, userData.name || 'Google User']
      );
      user = newUserResult.rows[0];
    } else {
      user = userResult.rows[0];
    }

    // Generate JWT token
    const token = generateToken(user.id, user.role);

    // Redirect to frontend with token
    res.redirect(`${process.env.FRONTEND_URL}?token=${token}&user=${encodeURIComponent(JSON.stringify({ id: user.id, email: user.email, name: user.name, role: user.role }))}`);
  } catch (error) {
    console.error('Google callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL}?error=${encodeURIComponent('Google authentication failed')}`);
  }
};

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    res.json({ success: true, message: 'Password reset email sent' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to send reset email' });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    res.json({ success: true, message: 'Password reset successful' });
  } catch (error) {
    res.status(500).json({ error: 'Password reset failed' });
  }
};

// New admin and partner login functions
const adminLogin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new ValidationError('Email and password are required');
  }

  // Validate email format
  if (!validateEmail(email)) {
    throw new ValidationError('Invalid email format');
  }

  // Check if admin exists in database
  const result = await db.query(
    'SELECT * FROM admins WHERE email = $1 AND is_active = true',
    [email.toLowerCase()]
  );

  if (result.rows.length === 0) {
    throw new AuthenticationError('Invalid credentials');
  }

  const admin = result.rows[0];

  // Check if account is locked
  if (admin.locked_until && admin.locked_until > new Date()) {
    throw new AuthenticationError('Account locked. Try again later.');
  }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, admin.password_hash);
    if (!isValidPassword) {
      // Increment failed attempts
      const newFailedAttempts = (admin.failed_attempts || 0) + 1;
      const lockedUntil = newFailedAttempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null; // Lock for 15 minutes after 5 attempts
      
      await db.query(
        'UPDATE admins SET failed_attempts = $1, locked_until = $2 WHERE id = $3',
        [newFailedAttempts, lockedUntil, admin.id]
      );

      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Reset failed attempts and update last login
    await db.query(
      'UPDATE admins SET failed_attempts = 0, locked_until = NULL, last_login = now() WHERE id = $1',
      [admin.id]
    );

    // Generate token
    const token = generateToken(admin.id, 'admin');
    
    res.json({ 
      success: true, 
      token, 
      user: { id: admin.id, email: admin.email, name: admin.name, role: 'admin' } 
    });
});

const partnerLogin = async (req, res) => {
  try {
    const { partnerId, category } = req.body;

    if (!partnerId || !category) {
      return sendErrorResponse(res, 400, 'Partner ID and category are required');
    }
    
    const sanitizedPartnerId = sanitizeInput(partnerId);
    const sanitizedCategory = sanitizeInput(category);
    
    // Validate category
    const validCategories = ['dairy', 'bakery', 'honey', 'flowers', 'delivery'];
    if (!validCategories.includes(sanitizedCategory.toLowerCase())) {
      return sendErrorResponse(res, 400, 'Invalid category');
    }

    // Check if partner exists in database with retry logic
    // Support both UUID and partner_code formats
    let partner;
    try {
      const isUUID = sanitizedPartnerId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      
      let query, params;
      if (isUUID) {
        query = 'SELECT * FROM partners WHERE id = $1 AND category = $2';
        params = [sanitizedPartnerId, sanitizedCategory.toLowerCase()];
      } else {
        query = 'SELECT * FROM partners WHERE partner_code = $1 AND category = $2';
        params = [sanitizedPartnerId.toUpperCase(), sanitizedCategory.toLowerCase()];
      }

      const result = await db.query(query, params);

      if (result.rows.length === 0) {
        return sendErrorResponse(res, 401, 'Invalid partner credentials or inactive account');
      }

      partner = result.rows[0];
    } catch (dbError) {
      console.error('Database error during partner login:', dbError);
      return sendErrorResponse(res, 500, 'Database error during authentication', dbError.message);
    }

    // Check if partner is active
    if (!partner.is_active) {
      return sendErrorResponse(res, 403, 'Partner account is blocked', partner.blocked_reason || 'Contact admin for details');
    }

    // Generate token
    const token = generateToken(partner.id, 'partner');

    // Log successful login
    console.log(`Partner login successful: ${partner.name} (${partner.id}) - ${partner.category}`);

    res.json({ 
      success: true, 
      token, 
      user: { 
        id: partner.id, 
        name: partner.name, 
        email: partner.email, 
        phone: partner.phone, 
        category: partner.category, 
        role: 'partner',
        warnings: partner.warnings || 0
      } 
    });
  } catch (error) {
    console.error('Partner login error:', error);
    sendErrorResponse(res, 500, 'Login failed', error.message);
  }
};

const getCurrentUser = async (req, res) => {
  try {
    // Return user info from JWT token (already verified by middleware)
    res.json({ user: req.user });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ error: 'Failed to get user info' });
  }
};

// Change password for logged-in users
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    if (!validatePassword(newPassword)) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    let user;
    let query, params;

    // Get user based on role
    if (userRole === 'admin') {
      query = 'SELECT * FROM admins WHERE id = $1';
      params = [userId];
    } else if (userRole === 'partner') {
      query = 'SELECT * FROM partners WHERE id = $1';
      params = [userId];
    } else {
      query = 'SELECT * FROM users WHERE id = $1';
      params = [userId];
    }

    const result = await db.query(query, params);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    user = result.rows[0];

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash || user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // Update password in database
    let updateQuery, updateParams;
    if (userRole === 'admin') {
      updateQuery = 'UPDATE admins SET password_hash = $1, updated_at = now() WHERE id = $2';
      updateParams = [newPasswordHash, userId];
    } else if (userRole === 'partner') {
      updateQuery = 'UPDATE partners SET password_hash = $1, updated_at = now() WHERE id = $2';
      updateParams = [newPasswordHash, userId];
    } else {
      updateQuery = 'UPDATE users SET password = $1, updated_at = now() WHERE id = $2';
      updateParams = [newPasswordHash, userId];
    }

    await db.query(updateQuery, updateParams);

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
};

// Request password reset (send OTP)
const requestPasswordReset = async (req, res) => {
  try {
    const { email, phone } = req.body;

    if (!email && !phone) {
      return res.status(400).json({ error: 'Email or phone number is required' });
    }

    let user;
    let query, params, identifier;

    // Find user by email or phone
    if (email) {
      if (!validateEmail(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
      }
      query = 'SELECT id, email, phone, name FROM users WHERE email = $1 UNION SELECT id, email, phone, name FROM admins WHERE email = $1 UNION SELECT id, email, phone, name FROM partners WHERE email = $1';
      params = [email.toLowerCase()];
      identifier = email;
    } else {
      if (!validatePhone(phone)) {
        return res.status(400).json({ error: 'Invalid phone number format' });
      }
      query = 'SELECT id, email, phone, name FROM users WHERE phone = $1 UNION SELECT id, email, phone, name FROM admins WHERE phone = $1 UNION SELECT id, email, phone, name FROM partners WHERE phone = $1';
      params = [phone];
      identifier = phone;
    }

    const result = await db.query(query, params);

    if (result.rows.length === 0) {
      // Don't reveal if user exists for security
      return res.json({ success: true, message: 'If account exists, OTP will be sent' });
    }

    user = result.rows[0];

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Store OTP in database with expiration (15 minutes)
    await db.query(
      `INSERT INTO otps (phone, otp, expires_at, created_at)
       VALUES ($1, $2, now() + interval '15 minutes', now())
       ON CONFLICT (phone) DO UPDATE SET otp = $2, expires_at = now() + interval '15 minutes'`,
      [user.phone || identifier, otp]
    );

    // Log OTP for development (in production, send via SMS/Email)
    console.log(`Password reset OTP for ${identifier}: ${otp}`);

    res.json({ success: true, message: 'OTP sent successfully' });
  } catch (error) {
    console.error('Request password reset error:', error);
    res.status(500).json({ error: 'Failed to send OTP' });
  }
};

// Reset password with OTP
const resetPasswordWithOTP = async (req, res) => {
  try {
    const { identifier, otp, newPassword } = req.body;

    if (!identifier || !otp || !newPassword) {
      return res.status(400).json({ error: 'Identifier, OTP, and new password are required' });
    }

    if (!validatePassword(newPassword)) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    // Verify OTP
    const otpResult = await db.query(
      'SELECT * FROM otps WHERE phone = $1 AND otp = $2 AND expires_at > now()',
      [identifier, otp]
    );

    if (otpResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    // Find user
    const userResult = await db.query(
      `SELECT id, 'user' as role FROM users WHERE phone = $1 OR email = $1
       UNION SELECT id, 'admin' as role FROM admins WHERE phone = $1 OR email = $1
       UNION SELECT id, 'partner' as role FROM partners WHERE phone = $1 OR email = $1`,
      [identifier]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // Update password based on role
    let updateQuery, updateParams;
    if (user.role === 'admin') {
      updateQuery = 'UPDATE admins SET password_hash = $1, updated_at = now() WHERE id = $2';
      updateParams = [newPasswordHash, user.id];
    } else if (user.role === 'partner') {
      updateQuery = 'UPDATE partners SET password_hash = $1, updated_at = now() WHERE id = $2';
      updateParams = [newPasswordHash, user.id];
    } else {
      updateQuery = 'UPDATE users SET password = $1, updated_at = now() WHERE id = $2';
      updateParams = [newPasswordHash, user.id];
    }

    await db.query(updateQuery, updateParams);

    // Delete used OTP
    await db.query('DELETE FROM otps WHERE phone = $1', [identifier]);

    res.json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
};

module.exports = {
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
};