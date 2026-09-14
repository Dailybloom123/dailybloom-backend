-- RBAC Roles and Data Privacy Migration
-- This migration adds role-based access control fields to users table

-- Create user_role enum if not exists
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('customer', 'vendor', 'admin');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Add role column to users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS role user_role NOT NULL DEFAULT 'customer';

-- Add assigned_zone_id for milk van partners
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS assigned_zone_id UUID
  REFERENCES delivery_zones(id) ON DELETE SET NULL;

-- Add partner_type column
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS partner_type VARCHAR(50);

-- Create indexes for RBAC queries
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_assigned_zone_id ON users(assigned_zone_id);
CREATE INDEX IF NOT EXISTS idx_users_partner_type ON users(partner_type);

-- Add comment
COMMENT ON COLUMN users.role IS 'User role: customer, vendor, or admin';
COMMENT ON COLUMN users.assigned_zone_id IS 'Assigned delivery zone for milk van partners';
COMMENT ON COLUMN users.partner_type IS 'Partner type: milk_van, florist, bakery, organic_partner';
