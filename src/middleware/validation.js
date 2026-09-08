const Joi = require('joi');

// Generic validation middleware
const validate = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.details.map(detail => detail.message)
      });
    }
    next();
  };
};

// Authentication validation schemas
const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required()
});

const guestLoginSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  phone: Joi.string().pattern(/^[0-9]{10}$/).required()
});

const otpRequestSchema = Joi.object({
  email: Joi.string().email(),
  phone: Joi.string().pattern(/^[0-9]{10}$/)
}).xor('email', 'phone');

const otpVerifySchema = Joi.object({
  email: Joi.string().email(),
  phone: Joi.string().pattern(/^[0-9]{10}$/),
  otp: Joi.string().length(6).required(),
  name: Joi.string().min(2).max(100)
}).xor('email', 'phone');

// Partner validation schemas
const partnerLoginSchema = Joi.object({
  partner_code: Joi.string().required(),
  category: Joi.string().valid('dairy', 'bakery', 'honey', 'flowers').required()
});

// Order validation schemas
const createOrderSchema = Joi.object({
  items: Joi.array().items(
    Joi.object({
      product_id: Joi.string().required(),
      quantity: Joi.number().integer().min(1).max(50).required(),
      price: Joi.number().positive().required()
    })
  ).min(1).required(),
  address_id: Joi.string().required(),
  payment_method: Joi.string().valid('cod', 'razorpay').required(),
  delivery_notes: Joi.string().max(500).allow('', null)
});

const updateOrderStatusSchema = Joi.object({
  status: Joi.string().valid(
    'pending_approval',
    'confirmed', 
    'packed',
    'out_for_delivery',
    'delivered',
    'fulfilled',
    'cancelled',
    'rejected'
  ).required(),
  notes: Joi.string().max(500).allow('', null)
});

// Address validation schemas
const createAddressSchema = Joi.object({
  ordering_for: Joi.string().valid('Myself', 'Family', 'Friend').required(),
  recipient_name: Joi.string().min(2).max(100).required(),
  recipient_phone: Joi.string().pattern(/^[0-9]{10}$/).required(),
  address_type: Joi.string().valid('Home', 'Office', 'Other').required(),
  custom_address_type: Joi.string().max(50).allow('', null),
  line1: Joi.string().min(5).max(200).required(),
  flat_house_number: Joi.string().max(50).allow('', null),
  street_building_society: Joi.string().max(100).allow('', null),
  locality: Joi.string().min(2).max(100).required(),
  city: Joi.string().min(2).max(50).required(),
  pincode: Joi.string().pattern(/^[0-9]{6}$/).required(),
  landmark: Joi.string().max(100).allow('', null),
  delivery_instructions: Joi.string().max(300).allow('', null)
});

// Product validation schemas
const createProductSchema = Joi.object({
  name: Joi.string().min(2).max(200).required(),
  category_id: Joi.string().required(),
  price: Joi.number().positive().required(),
  unit: Joi.string().max(50).required(),
  description: Joi.string().max(1000).allow('', null),
  image_url: Joi.string().uri().allow('', null),
  in_stock: Joi.boolean().default(true),
  subscribable: Joi.boolean().default(false),
  pre_order: Joi.boolean().default(false),
  instant_order: Joi.boolean().default(true),
  early_morning_delivery: Joi.boolean().default(false)
});

// Payout validation schemas
const updateBankDetailsSchema = Joi.object({
  bank_account_name: Joi.string().min(2).max(200).required(),
  bank_account_number: Joi.string().min(8).max(30).required(),
  bank_ifsc_code: Joi.string().pattern(/^[A-Z]{4}0[A-Z0-9]{6}$/).required(),
  bank_account_type: Joi.string().valid('savings', 'current').default('savings')
});

const createPayoutRequestSchema = Joi.object({
  admin_id: Joi.string().required()
});

const processPayoutSchema = Joi.object({
  admin_id: Joi.string().required(),
  utr_number: Joi.string().min(12).max(30).required(),
  remarks: Joi.string().max(500).allow('', null)
});

// Feedback validation schemas
const createFeedbackSchema = Joi.object({
  order_id: Joi.string().required(),
  rating: Joi.number().integer().min(1).max(5).required(),
  comments: Joi.string().max(1000).allow('', null),
  partner_rating: Joi.number().integer().min(1).max(5).allow(null),
  delivery_rating: Joi.number().integer().min(1).max(5).allow(null)
});

// Complaint validation schemas
const createComplaintSchema = Joi.object({
  order_id: Joi.string().required(),
  issue_type: Joi.string().valid(
    'wrong_items',
    'damaged_items',
    'late_delivery',
    'missing_items',
    'quality_issue',
    'other'
  ).required(),
  description: Joi.string().min(10).max(1000).required(),
  images: Joi.array().items(Joi.string().uri()).max(5).allow(null)
});

// Sanitization helper to prevent XSS
const sanitizeInput = (obj) => {
  if (typeof obj === 'string') {
    return obj.replace(/[<>]/g, '');
  }
  if (Array.isArray(obj)) {
    return obj.map(sanitizeInput);
  }
  if (obj && typeof obj === 'object') {
    const sanitized = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        sanitized[key] = sanitizeInput(obj[key]);
      }
    }
    return sanitized;
  }
  return obj;
};

// SQL injection prevention helper
const sanitizeSQL = (str) => {
  if (typeof str !== 'string') return str;
  return str.replace(/['";\\]/g, '');
};

module.exports = {
  validate,
  sanitizeInput,
  sanitizeSQL,
  loginSchema,
  guestLoginSchema,
  otpRequestSchema,
  otpVerifySchema,
  partnerLoginSchema,
  createOrderSchema,
  updateOrderStatusSchema,
  createAddressSchema,
  createProductSchema,
  updateBankDetailsSchema,
  createPayoutRequestSchema,
  processPayoutSchema,
  createFeedbackSchema,
  createComplaintSchema
};