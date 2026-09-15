const crypto = require('crypto');

/**
 * CSRF Protection Middleware
 * Generates and validates CSRF tokens for state-changing requests
 */

// Store tokens in memory (in production, use Redis or database)
const csrfTokens = new Map();

/**
 * Generate CSRF token
 */
const generateCSRFToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * CSRF protection middleware
 */
const csrfProtection = (req, res, next) => {
  // Skip CSRF for GET, HEAD, OPTIONS requests (safe methods)
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Skip CSRF for API routes that use JWT authentication
  if (req.headers.authorization) {
    return next();
  }

  // Skip CSRF if session is not configured (API-only usage)
  if (!req.session) {
    return next();
  }

  const token = req.headers['x-csrf-token'] || req.body._csrf;
  const sessionToken = req.session?.csrfToken;

  if (!token || !sessionToken || token !== sessionToken) {
    return res.status(403).json({ 
      error: 'CSRF token validation failed',
      message: 'Invalid or missing CSRF token' 
    });
  }

  next();
};

/**
 * CSRF token middleware - generates and stores token
 */
const csrfTokenMiddleware = (req, res, next) => {
  if (!req.session) {
    // If session is not configured, skip CSRF (for API-only usage)
    res.locals.csrfToken = null;
    return next();
  }

  // Generate new token if not exists
  if (!req.session.csrfToken) {
    req.session.csrfToken = generateCSRFToken();
  }

  // Add token to response
  res.locals.csrfToken = req.session.csrfToken;
  
  // Add token to response headers
  res.setHeader('X-CSRF-Token', req.session.csrfToken);
  
  next();
};

/**
 * Clear CSRF token after use
 */
const clearCSRFToken = (req) => {
  if (req.session && req.session.csrfToken) {
    delete req.session.csrfToken;
  }
};

module.exports = {
  csrfProtection,
  csrfTokenMiddleware,
  generateCSRFToken,
  clearCSRFToken,
};
