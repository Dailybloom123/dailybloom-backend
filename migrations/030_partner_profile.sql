-- Partner Profile Migration for Public Transparency
-- This migration adds partner profile fields for public directory

-- Add partner profile fields to users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS business_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS slug VARCHAR(255) UNIQUE,
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS locality VARCHAR(255),
  ADD COLUMN IF NOT EXISTS fssai_number VARCHAR(50),
  ADD COLUMN IF NOT EXISTS fssai_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS specialty_tags TEXT[],
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT TRUE;

-- Create indexes for partner directory
CREATE INDEX IF NOT EXISTS idx_users_slug ON users(slug);
CREATE INDEX IF NOT EXISTS idx_users_business_name ON users(business_name);
CREATE INDEX IF NOT EXISTS idx_users_is_public ON users(is_public);
CREATE INDEX IF NOT EXISTS idx_users_locality ON users(locality);

-- Ensure products can reference partners
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS partner_id UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_products_partner_id ON products(partner_id);

-- Add comments
COMMENT ON COLUMN users.business_name IS 'Partner business name for public display';
COMMENT ON COLUMN users.slug IS 'URL-friendly identifier for partner profile pages';
COMMENT ON COLUMN users.bio IS 'Partner business description/bio';
COMMENT ON COLUMN users.locality IS 'Partner operating locality';
COMMENT ON COLUMN users.fssai_number IS 'FSSAI license number';
COMMENT ON COLUMN users.fssai_verified IS 'Whether FSSAI license is verified';
COMMENT ON COLUMN users.specialty_tags IS 'Array of specialty tags (e.g., dairy, flowers, bakery)';
COMMENT ON COLUMN users.is_public IS 'Whether partner profile is publicly visible';
COMMENT ON COLUMN products.partner_id IS 'Partner who supplies this product';
