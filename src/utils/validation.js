// Shared validation utilities for all controllers

/**
 * Validates UUID format
 */
const validateUUID = (id) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
};

/**
 * Validates integer within range
 */
const validateInteger = (value, min = 0, max = null) => {
  const num = parseInt(value, 10);
  if (isNaN(num)) return false;
  if (num < min) return false;
  if (max !== null && num > max) return false;
  return true;
};

/**
 * Validates string length
 */
const validateString = (value, minLength = 0, maxLength = 1000) => {
  if (typeof value !== 'string') return false;
  if (value.length < minLength) return false;
  if (value.length > maxLength) return false;
  return true;
};

/**
 * Validates email format
 */
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validates phone number (10 digits)
 */
const validatePhone = (phone) => {
  const phoneRegex = /^[0-9]{10}$/;
  return phoneRegex.test(phone.replace(/[^0-9]/g, ''));
};

/**
 * Validates Indian pincode (6 digits)
 */
const validatePincode = (pincode) => {
  const pincodeRegex = /^[0-9]{6}$/;
  return pincodeRegex.test(pincode);
};

/**
 * Validates coordinates
 */
const validateCoordinates = (lat, lng) => {
  if (lat === null || lng === null) return true; // Allow null coordinates
  const latNum = parseFloat(lat);
  const lngNum = parseFloat(lng);
  if (isNaN(latNum) || isNaN(lngNum)) return false;
  if (latNum < -90 || latNum > 90) return false;
  if (lngNum < -180 || lngNum > 180) return false;
  return true;
};

/**
 * Validates decimal number within range
 */
const validateDecimal = (value, min = 0, max = null) => {
  const num = parseFloat(value);
  if (isNaN(num)) return false;
  if (num < min) return false;
  if (max !== null && num > max) return false;
  return true;
};

/**
 * Validates category
 */
const validateCategory = (category) => {
  const validCategories = ['dairy', 'bakery', 'honey', 'flowers', 'organic'];
  return validCategories.includes(category.toLowerCase());
};

/**
 * Validates order status
 */
const validateOrderStatus = (status) => {
  const validStatuses = ['pending', 'confirmed', 'in_progress', 'out_for_delivery', 'delivered', 'fulfilled', 'cancelled'];
  return validStatuses.includes(status);
};

/**
 * Validates order sub-status
 */
const validateOrderSubStatus = (subStatus) => {
  const validSubStatuses = ['packed', 'ready_for_dispatch', 'out_for_delivery'];
  return validSubStatuses.includes(subStatus);
};

/**
 * Sanitizes string input (removes potential XSS)
 */
const sanitizeString = (value) => {
  if (typeof value !== 'string') return value;
  return value.trim().replace(/[<>]/g, '');
};

/**
 * Validates date format
 */
const validateDate = (date) => {
  const dateObj = new Date(date);
  return !isNaN(dateObj.getTime());
};

/**
 * Validates boolean
 */
const validateBoolean = (value) => {
  return typeof value === 'boolean';
};

/**
 * Validates array with optional length constraints
 */
const validateArray = (value, minLength = 0, maxLength = null) => {
  if (!Array.isArray(value)) return false;
  if (value.length < minLength) return false;
  if (maxLength !== null && value.length > maxLength) return false;
  return true;
};

/**
 * Validates object has required fields
 */
const validateRequiredFields = (obj, requiredFields) => {
  if (!obj || typeof obj !== 'object') return false;
  return requiredFields.every(field => obj[field] !== undefined && obj[field] !== null);
};

module.exports = {
  validateUUID,
  validateInteger,
  validateString,
  validateEmail,
  validatePhone,
  validatePincode,
  validateCoordinates,
  validateDecimal,
  validateCategory,
  validateOrderStatus,
  validateOrderSubStatus,
  sanitizeString,
  validateDate,
  validateBoolean,
  validateArray,
  validateRequiredFields,
};
