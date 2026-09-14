-- Add soft delete functionality to addresses
-- This allows archiving addresses instead of hard deletion

-- Add is_deleted flag to addresses table
ALTER TABLE addresses ADD COLUMN is_deleted BOOLEAN NOT NULL DEFAULT false;

-- Add recipient_name and delivery_instructions columns if they don't exist
ALTER TABLE addresses ADD COLUMN IF NOT EXISTS recipient_name VARCHAR(100);
ALTER TABLE addresses ADD COLUMN IF NOT EXISTS delivery_instructions TEXT;

-- Update foreign key constraints to allow deletion
-- Drop existing foreign key constraints on orders.address_id
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_address_id_fkey;
ALTER TABLE orders ADD CONSTRAINT orders_address_id_fkey 
  FOREIGN KEY (address_id) REFERENCES addresses(id) ON DELETE SET NULL;

-- Drop existing foreign key constraints on subscriptions.address_id  
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_address_id_fkey;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_address_id_fkey 
  FOREIGN KEY (address_id) REFERENCES addresses(id) ON DELETE SET NULL;

-- Create index for filtering non-deleted addresses
CREATE INDEX idx_addresses_not_deleted ON addresses(user_id) WHERE is_deleted = false;
