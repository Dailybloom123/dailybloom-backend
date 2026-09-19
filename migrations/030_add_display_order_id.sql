-- Migration 030: Add display_order_id column to orders table
-- This adds a human-readable display order ID using PostgreSQL SEQUENCE

-- Create a sequence for display order IDs
CREATE SEQUENCE IF NOT EXISTS display_order_id_seq
    START WITH 1001
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- Add display_order_id column to orders table (no default - will be set in application code)
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS display_order_id VARCHAR(20) UNIQUE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_orders_display_order_id ON orders(display_order_id);

-- Add comment
COMMENT ON COLUMN orders.display_order_id IS 'Human-readable display order ID (e.g., DB-1001) for customer-facing UI';
COMMENT ON SEQUENCE display_order_id_seq IS 'Sequence for generating human-readable order IDs';
