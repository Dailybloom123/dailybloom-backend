const { AuthenticationError } = require('./errorHandler');

/**
 * RBAC Middleware - Role-Based Access Control and Data Privacy Shield
 */

/**
 * Check if user has required role
 */
const hasRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      throw new AuthenticationError('Authentication required');
    }

    if (!allowedRoles.includes(req.user.role)) {
      throw new AuthenticationError('Insufficient permissions');
    }

    next();
  };
};

/**
 * Filter order data based on user role
 * - Customers: Only their own orders
 * - Partners: Orders assigned to them, with sensitive data redacted
 * - Admins: All orders with full data
 */
const filterOrderData = (req, res, next) => {
  const originalJson = res.json.bind(res);

  res.json = function (data) {
    if (data.orders && Array.isArray(data.orders)) {
      data.orders = data.orders.map(order => filterOrderForRole(order, req.user));
    } else if (data.order) {
      data.order = filterOrderForRole(data.order, req.user);
    }

    return originalJson(data);
  };

  next();
};

/**
 * Filter a single order based on user role
 */
const filterOrderForRole = (order, user) => {
  if (!order) return order;

  // Customer: Only their own orders
  if (user.role === 'customer') {
    if (order.user_id !== user.id) {
      return null; // Not their order
    }
    return order; // Full data for their own order
  }

  // Partner: Redact sensitive fields
  if (user.role === 'vendor') {
    // Only show orders assigned to this partner
    if (order.assigned_partner_id !== user.id) {
      return null;
    }

    // Redact sensitive fields
    const filteredOrder = { ...order };
    delete filteredOrder.user_phone;
    delete filteredOrder.user_email;
    delete filteredOrder.platform_revenue;
    delete filteredOrder.item_base_margin;
    delete filteredOrder.billing_commission;
    delete filteredOrder.other_partner_data;

    return filteredOrder;
  }

  // Admin: Full access
  return order;
};

/**
 * Add user_id filter for customer queries
 */
const customerFilter = (req, res, next) => {
  if (req.user.role === 'customer') {
    req.customerFilter = { user_id: req.user.id };
  }
  next();
};

/**
 * Add zone filter for milk van partners
 */
const milkVanFilter = (req, res, next) => {
  if (req.user.role === 'vendor' && req.user.partner_type === 'milk_van') {
    req.zoneFilter = { zone_id: req.user.assigned_zone_id };
  }
  next();
};

/**
 * Add coverage radius filter for florists
 */
const floristFilter = (req, res, next) => {
  if (req.user.role === 'vendor' && req.user.partner_type === 'florist') {
    req.floristFilter = {
      claimed_by_vendor_id: req.user.id,
      coverage_radius: req.user.coverage_radius || 5 // Default 5km
    };
  }
  next();
};

/**
 * Add bakery-specific filter
 */
const bakeryFilter = (req, res, next) => {
  if (req.user.role === 'vendor' && req.user.partner_type === 'bakery') {
    req.bakeryFilter = {
      assigned_partner_id: req.user.id,
      delivery_slot: '10:00-13:00'
    };
  }
  next();
};

/**
 * Data privacy shield - Strip sensitive fields from partner responses
 */
const dataPrivacyShield = (req, res, next) => {
  if (req.user.role !== 'vendor') {
    return next();
  }

  const originalJson = res.json.bind(res);

  res.json = function (data) {
    // Strip sensitive fields from all responses
    const stripSensitive = (obj) => {
      if (!obj || typeof obj !== 'object') return obj;

      const sensitiveFields = [
        'phone',
        'email',
        'platform_revenue',
        'item_base_margin',
        'billing_commission',
        'partner_commission',
        'other_partner_data',
        'internal_notes'
      ];

      if (Array.isArray(obj)) {
        return obj.map(item => stripSensitive(item));
      }

      const stripped = { ...obj };
      sensitiveFields.forEach(field => {
        delete stripped[field];
      });

      return stripped;
    };

    return originalJson(stripSensitive(data));
  };

  next();
};

module.exports = {
  hasRole,
  filterOrderData,
  customerFilter,
  milkVanFilter,
  floristFilter,
  bakeryFilter,
  dataPrivacyShield
};
