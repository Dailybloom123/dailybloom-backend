-- Migration 008: Add delivered_at column to orders table
-- This gives a precise, immutable timestamp of when an order was delivered.
-- The feedback (1hr after) and complaint (within 1hr) windows are calculated from this.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP;

-- Backfill: for any already-delivered orders, set delivered_at = updated_at
-- (best approximation we have for historical data)
UPDATE orders SET delivered_at = updated_at WHERE status = 'delivered' AND delivered_at IS NULL;

-- Index for fast lookups on the delivery time window queries
CREATE INDEX IF NOT EXISTS idx_orders_delivered_at ON orders(delivered_at);
CREATE INDEX IF NOT EXISTS idx_orders_status_delivered_at ON orders(status, delivered_at);
