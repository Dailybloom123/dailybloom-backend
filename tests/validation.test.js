const { 
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
  sanitizeString 
} = require('../src/utils/validation');

describe('Validation Utilities', () => {
  describe('validateUUID', () => {
    test('should validate correct UUID format', () => {
      expect(validateUUID('550e8400-e29b-41d4-a716-446655440001')).toBe(true);
      expect(validateUUID('550e8400-e29b-41d4-a716-446655440002')).toBe(true);
    });

    test('should reject invalid UUID format', () => {
      expect(validateUUID('invalid-uuid')).toBe(false);
      expect(validateUUID('prod_1')).toBe(false);
      expect(validateUUID('')).toBe(false);
      expect(validateUUID(null)).toBe(false);
    });
  });

  describe('validateInteger', () => {
    test('should validate correct integers', () => {
      expect(validateInteger(5)).toBe(true);
      expect(validateInteger(0)).toBe(true);
      expect(validateInteger(100)).toBe(true);
    });

    test('should validate integer within range', () => {
      expect(validateInteger(5, 0, 10)).toBe(true);
      expect(validateInteger(15, 0, 10)).toBe(false);
      expect(validateInteger(-1, 0)).toBe(false);
    });

    test('should reject invalid integers', () => {
      expect(validateInteger('abc')).toBe(false);
      expect(validateInteger(null)).toBe(false);
      expect(validateInteger(undefined)).toBe(false);
    });
  });

  describe('validateString', () => {
    test('should validate correct strings', () => {
      expect(validateString('hello')).toBe(true);
      expect(validateString('hello world')).toBe(true);
    });

    test('should validate string length', () => {
      expect(validateString('hi', 1, 10)).toBe(true);
      expect(validateString('a', 2, 10)).toBe(false);
      expect(validateString('very long string', 1, 5)).toBe(false);
    });

    test('should reject invalid strings', () => {
      expect(validateString(123)).toBe(false);
      expect(validateString(null)).toBe(false);
      expect(validateString(undefined)).toBe(false);
    });
  });

  describe('validateEmail', () => {
    test('should validate correct email format', () => {
      expect(validateEmail('test@example.com')).toBe(true);
      expect(validateEmail('user.name+tag@example.co.uk')).toBe(true);
    });

    test('should reject invalid email format', () => {
      expect(validateEmail('invalid')).toBe(false);
      expect(validateEmail('invalid@')).toBe(false);
      expect(validateEmail('@example.com')).toBe(false);
    });
  });

  describe('validatePhone', () => {
    test('should validate correct phone format', () => {
      expect(validatePhone('9876543210')).toBe(true);
      expect(validatePhone('98765-43210')).toBe(true);
      expect(validatePhone('+91 98765 43210')).toBe(true);
    });

    test('should reject invalid phone format', () => {
      expect(validatePhone('123')).toBe(false);
      expect(validatePhone('abcdefghij')).toBe(false);
      expect(validatePhone('')).toBe(false);
    });
  });

  describe('validatePincode', () => {
    test('should validate correct pincode format', () => {
      expect(validatePincode('781001')).toBe(true);
      expect(validatePincode('110001')).toBe(true);
    });

    test('should reject invalid pincode format', () => {
      expect(validatePincode('12345')).toBe(false);
      expect(validatePincode('1234567')).toBe(false);
      expect(validatePincode('abcdef')).toBe(false);
    });
  });

  describe('validateCoordinates', () => {
    test('should validate correct coordinates', () => {
      expect(validateCoordinates(26.1445, 91.7362)).toBe(true);
      expect(validateCoordinates(0, 0)).toBe(true);
      expect(validateCoordinates(-90, -180)).toBe(true);
      expect(validateCoordinates(90, 180)).toBe(true);
    });

    test('should allow null coordinates', () => {
      expect(validateCoordinates(null, null)).toBe(true);
    });

    test('should reject invalid coordinates', () => {
      expect(validateCoordinates(91, 0)).toBe(false);
      expect(validateCoordinates(0, 181)).toBe(false);
      expect(validateCoordinates('invalid', 'invalid')).toBe(false);
    });
  });

  describe('validateCategory', () => {
    test('should validate correct categories', () => {
      expect(validateCategory('dairy')).toBe(true);
      expect(validateCategory('bakery')).toBe(true);
      expect(validateCategory('flowers')).toBe(true);
    });

    test('should reject invalid categories', () => {
      expect(validateCategory('invalid')).toBe(false);
      expect(validateCategory('')).toBe(false);
    });
  });

  describe('validateOrderStatus', () => {
    test('should validate correct order statuses', () => {
      expect(validateOrderStatus('pending')).toBe(true);
      expect(validateOrderStatus('confirmed')).toBe(true);
      expect(validateOrderStatus('in_progress')).toBe(true);
      expect(validateOrderStatus('out_for_delivery')).toBe(true);
      expect(validateOrderStatus('delivered')).toBe(true);
      expect(validateOrderStatus('fulfilled')).toBe(true);
      expect(validateOrderStatus('cancelled')).toBe(true);
    });

    test('should reject invalid order statuses', () => {
      expect(validateOrderStatus('invalid')).toBe(false);
      expect(validateOrderStatus('')).toBe(false);
    });
  });

  describe('validateOrderSubStatus', () => {
    test('should validate correct order sub-statuses', () => {
      expect(validateOrderSubStatus('packed')).toBe(true);
      expect(validateOrderSubStatus('ready_for_dispatch')).toBe(true);
      expect(validateOrderSubStatus('out_for_delivery')).toBe(true);
    });

    test('should reject invalid order sub-statuses', () => {
      expect(validateOrderSubStatus('invalid')).toBe(false);
      expect(validateOrderSubStatus('')).toBe(false);
    });
  });

  describe('sanitizeString', () => {
    test('should sanitize HTML tags', () => {
      expect(sanitizeString('<script>alert("xss")</script>')).toBe('scriptalert("xss")/script');
      expect(sanitizeString('<div>content</div>')).toBe('divcontent/div');
    });

    test('should trim whitespace', () => {
      expect(sanitizeString('  hello  ')).toBe('hello');
    });

    test('should handle non-string inputs', () => {
      expect(sanitizeString(123)).toBe(123);
      expect(sanitizeString(null)).toBe(null);
    });
  });
});
