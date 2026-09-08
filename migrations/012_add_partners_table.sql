-- Add partners table for Admin Dashboard partner management
-- This table is separate from vendors and is used for managing delivery partners
-- and vendor relationships through the admin interface

CREATE TABLE partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(150) NOT NULL,
  phone VARCHAR(15) NOT NULL,
  email VARCHAR(150),
  address TEXT,
  category VARCHAR(50), -- 'dairy' | 'bakery' | 'honey' | 'flowers' | 'delivery' | etc.
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add partner_id to orders table for assignment
ALTER TABLE orders ADD COLUMN IF NOT EXISTS partner_id UUID REFERENCES partners(id) ON DELETE SET NULL;

-- Create index for partner lookups
CREATE INDEX IF NOT EXISTS idx_partners_category ON partners(category);
CREATE INDEX IF NOT EXISTS idx_orders_partner ON orders(partner_id);
