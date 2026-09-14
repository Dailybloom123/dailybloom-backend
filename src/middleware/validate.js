const Joi = require('joi');

// Validation schemas
const schemas = {
  // Auth validation
  requestOtp: Joi.object({
    phone: Joi.string().pattern(/^(\+91)?[0-9]{10}$/).optional(),
    email: Joi.string().email().optional()
  }).xor('phone', 'email'),

  verifyOtp: Joi.object({
    phone: Joi.string().pattern(/^(\+91)?[0-9]{10}$/).optional(),
    email: Joi.string().email().optional(),
    otp: Joi.string().length(6).required(),
    name: Joi.string().min(2).max(100).optional()
  }).xor('phone', 'email'),

  // Order validation
  createOrder: Joi.object({
    items: Joi.array().items(
      Joi.object({
        product_id: Joi.string().uuid().required(),
        quantity: Joi.number().integer().min(1).max(100).required()
      })
    ).min(1).required(),
    address_id: Joi.string().uuid().required(),
    delivery_slot: Joi.string().valid('today_evening', 'tomorrow_morning', 'tomorrow_evening').required()
  }),

  // Address validation
  createAddress: Joi.object({
    recipient_name: Joi.string().min(2).max(100).required(),
    contact_number: Joi.string().pattern(/^[0-9]{10}$/).required(),
    line1: Joi.string().min(5).max(255).required(),
    locality: Joi.string().min(2).max(100).required(),
    city: Joi.string().min(2).max(100).required(),
    pincode: Joi.string().pattern(/^[0-9]{6}$/).required(),
    delivery_instructions: Joi.string().max(100).optional(),
    latitude: Joi.number().min(-90).max(90).optional(),
    longitude: Joi.number().min(-180).max(180).optional()
  }),

  // Product validation
  createProduct: Joi.object({
    name: Joi.string().min(2).max(200).required(),
    category: Joi.string().valid('dairy', 'flowers', 'bakery').required(),
    price: Joi.number().positive().required(),
    unit: Joi.string().min(1).max(50).required(),
    vendor_id: Joi.string().uuid().required(),
    description: Joi.string().max(1000).optional(),
    subscribable: Joi.boolean().optional(),
    stock: Joi.number().integer().min(0).optional()
  })
};

// Validation middleware factory
const validate = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));
      return res.status(400).json({
        error: 'Validation failed',
        details: errors
      });
    }

    req.body = value;
    next();
  };
};

module.exports = {
  validate,
  schemas
};
