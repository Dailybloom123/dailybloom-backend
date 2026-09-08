-- Add a test partner for development testing
INSERT INTO partners (name, phone, email, address, category, partner_code, is_active, warnings, blocked_reason)
VALUES (
  'Test Dairy Partner',
  '9876543210',
  'testpartner@dailybloom.com',
  'Test Address, Guwahati',
  'dairy',
  'TEST001',
  true,
  0,
  NULL
)
ON CONFLICT (partner_code) DO UPDATE SET
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  email = EXCLUDED.email,
  address = EXCLUDED.address,
  category = EXCLUDED.category,
  is_active = EXCLUDED.is_active,
  warnings = EXCLUDED.warnings,
  blocked_reason = EXCLUDED.blocked_reason;