-- Migration 028: Add partner_id foreign key to products table
-- This establishes the relationship between products and partners

-- Add partner_id column to products table
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS partner_id UUID REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_products_partner_id ON products(partner_id);
CREATE INDEX IF NOT EXISTS idx_products_vendor_id ON products(vendor_id);

-- Add comment
COMMENT ON COLUMN products.partner_id IS 'Foreign key to the partner (vendor) who owns this product';
COMMENT ON COLUMN products.vendor_id IS 'Foreign key to the vendor account (alternative to partner_id)';
