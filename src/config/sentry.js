const Sentry = require('@sentry/node');

/**
 * Initialize Sentry for error tracking
 */
function initSentry() {
  if (!process.env.SENTRY_DSN) {
    console.log('⚠️ SENTRY_DSN not configured - Sentry disabled');
    return;
  }

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0.0,
    beforeSend(event, hint) {
      // Filter out sensitive data
      if (event.request) {
        // Remove headers with sensitive data
        if (event.request.headers) {
          delete event.request.headers.authorization;
          delete event.request.headers.cookie;
        }
        // Remove query parameters with sensitive data
        if (event.request.query_string) {
          const queryString = event.request.query_string;
          if (queryString.password) delete queryString.password;
          if (queryString.token) delete queryString.token;
          if (queryString.api_key) delete queryString.api_key;
        }
      }
      return event;
    }
  });

  console.log('✅ Sentry initialized');
}

/**
 * Capture error in Sentry
 * @param {Error} error - Error object
 * @param {Object} context - Additional context
 */
function captureError(error, context = {}) {
  if (!process.env.SENTRY_DSN) {
    console.error('Error (Sentry disabled):', error);
    return;
  }

  Sentry.captureException(error, {
    extra: context
  });
}

/**
 * Capture message in Sentry
 * @param {string} message - Message to capture
 * @param {string} level - Log level (info, warning, error)
 */
function captureMessage(message, level = 'info') {
  if (!process.env.SENTRY_DSN) {
    console.log(`Message (Sentry disabled): [${level}] ${message}`);
    return;
  }

  Sentry.captureMessage(message, level);
}

/**
 * Set user context in Sentry
 * @param {Object} user - User object
 */
function setUser(user) {
  if (!process.env.SENTRY_DSN) return;

  Sentry.setUser({
    id: user.id,
    email: user.email,
    role: user.role
  });
}

/**
 * Clear user context from Sentry
 */
function clearUser() {
  if (!process.env.SENTRY_DSN) return;

  Sentry.setUser(null);
}

module.exports = {
  initSentry,
  captureError,
  captureMessage,
  setUser,
  clearUser,
  Sentry
};
