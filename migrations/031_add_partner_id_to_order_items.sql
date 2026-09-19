-- Migration 031: Add partner_id column to order_items table
-- This snapshots the partner_id at order creation time for historical accuracy

-- Add partner_id column to order_items table
ALTER TABLE order_items 
ADD COLUMN IF NOT EXISTS partner_id UUID REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS item_status VARCHAR(50) DEFAULT 'pending';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_order_items_partner_id ON order_items(partner_id);
CREATE INDEX IF NOT EXISTS idx_order_items_status ON order_items(item_status);

-- Add comments
COMMENT ON COLUMN order_items.partner_id IS 'Snapshot of partner_id at order creation - prevents data corruption when partners are reassigned';
COMMENT ON COLUMN order_items.item_status IS 'Item-level status for partner acceptance/rejection workflow';
