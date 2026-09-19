-- Migration 029: Create test partner account
-- This creates a test partner account for development/testing

-- Insert test partner (vendor) account
INSERT INTO users (id, email, password, name, phone, role, partner_type, is_active, created_at, updated_at)
VALUES (
  '550e8400-e29b-41d4-a716-446655440000',
  'partner@dailybloom.com',
  '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890123456789012345678901234567890123456789012', -- DailyBloom@123 (hashed with bcrypt)
  'Test Partner',
  '+919876543210',
  'vendor',
  'milk_van',
  true,
  NOW(),
  NOW()
) ON CONFLICT (email) DO NOTHING;

-- Add comment
COMMENT ON TABLE users IS 'Users table including customers, admins, and partners/vendors';
