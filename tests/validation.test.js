const {
  validate,
  sanitizeInput,
  sanitizeSQL,
  loginSchema,
  createOrderSchema,
  createAddressSchema
} = require('../src/middleware/validation');

describe('Validation Middleware', () => {
  describe('validate', () => {
    it('should pass valid data', () => {
      const req = { body: { email: 'test@example.com', password: 'password123' } };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      const middleware = validate(loginSchema);
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should reject invalid data', () => {
      const req = { body: { email: 'invalid-email', password: '123' } };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      const middleware = validate(loginSchema);
      middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Validation failed'
        })
      );
    });
  });

  describe('sanitizeInput', () => {
    it('should remove HTML tags from strings', () => {
      const input = '<script>alert("xss")</script>';
      const sanitized = sanitizeInput(input);
      expect(sanitized).not.toContain('<');
      expect(sanitized).not.toContain('>');
    });

    it('should sanitize nested objects', () => {
      const input = {
        name: '<script>alert("xss")</script>',
        nested: {
          value: '<img src=x onerror=alert(1)>'
        }
      };
      const sanitized = sanitizeInput(input);
      expect(sanitized.name).not.toContain('<');
      expect(sanitized.nested.value).not.toContain('<');
    });

    it('should sanitize arrays', () => {
      const input = ['<script>alert(1)</script>', '<img src=x onerror=alert(1)>'];
      const sanitized = sanitizeInput(input);
      expect(sanitized[0]).not.toContain('<');
      expect(sanitized[1]).not.toContain('<');
    });

    it('should handle non-string values', () => {
      expect(sanitizeInput(123)).toBe(123);
      expect(sanitizeInput(null)).toBe(null);
      expect(sanitizeInput(undefined)).toBe(undefined);
    });
  });

  describe('sanitizeSQL', () => {
    it('should remove SQL injection characters', () => {
      const input = "'; DROP TABLE users; --";
      const sanitized = sanitizeSQL(input);
      expect(sanitized).not.toContain("'");
      expect(sanitized).not.toContain(';');
      expect(sanitized).not.toContain('--');
    });

    it('should handle non-string values', () => {
      expect(sanitizeSQL(123)).toBe(123);
      expect(sanitizeSQL(null)).toBe(null);
    });
  });

  describe('Schema Validation', () => {
    it('should validate login schema', () => {
      const validData = { email: 'test@example.com', password: 'password123' };
      const { error } = loginSchema.validate(validData);
      expect(error).toBeUndefined();
    });

    it('should reject invalid email in login schema', () => {
      const invalidData = { email: 'invalid-email', password: 'password123' };
      const { error } = loginSchema.validate(invalidData);
      expect(error).toBeDefined();
    });

    it('should reject short password in login schema', () => {
      const invalidData = { email: 'test@example.com', password: '123' };
      const { error } = loginSchema.validate(invalidData);
      expect(error).toBeDefined();
    });

    it('should validate order schema', () => {
      const validData = {
        items: [
          { product_id: '123', quantity: 2, price: 100 }
        ],
        address_id: '456',
        payment_method: 'cod'
      };
      const { error } = createOrderSchema.validate(validData);
      expect(error).toBeUndefined();
    });

    it('should reject empty items in order schema', () => {
      const invalidData = {
        items: [],
        address_id: '456',
        payment_method: 'cod'
      };
      const { error } = createOrderSchema.validate(invalidData);
      expect(error).toBeDefined();
    });

    it('should validate address schema', () => {
      const validData = {
        ordering_for: 'Myself',
        recipient_name: 'John Doe',
        recipient_phone: '1234567890',
        address_type: 'Home',
        line1: '123 Main St',
        locality: 'Downtown',
        city: 'Guwahati',
        pincode: '781001'
      };
      const { error } = createAddressSchema.validate(validData);
      expect(error).toBeUndefined();
    });

    it('should reject invalid phone in address schema', () => {
      const invalidData = {
        ordering_for: 'Myself',
        recipient_name: 'John Doe',
        recipient_phone: '123',
        address_type: 'Home',
        line1: '123 Main St',
        locality: 'Downtown',
        city: 'Guwahati',
        pincode: '781001'
      };
      const { error } = createAddressSchema.validate(invalidData);
      expect(error).toBeDefined();
    });
  });
});
