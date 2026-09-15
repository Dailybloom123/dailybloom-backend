-- Performance Optimization Migration
-- This migration adds indexes to improve query performance for common operations

-- Orders table indexes
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_zone_id ON orders(zone_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_user_status ON orders(user_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_delivery_status ON orders(delivery_date, status);

-- Products table indexes
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_vendor_active ON products(vendor_id, is_active);
CREATE INDEX IF NOT EXISTS idx_products_category_active ON products(category, is_active);

-- Users table indexes
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);

-- Addresses table indexes
CREATE INDEX IF NOT EXISTS idx_addresses_zone_id ON addresses(zone_id);
CREATE INDEX IF NOT EXISTS idx_addresses_user_default ON addresses(user_id, is_default);

-- Vendors table indexes
CREATE INDEX IF NOT EXISTS idx_vendors_is_active ON vendors(is_active);
CREATE INDEX IF NOT EXISTS idx_vendors_zone_active ON vendors(zone_id, is_active);

-- Order items table indexes
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);

-- Subscriptions table indexes
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_status ON subscriptions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_product ON subscriptions(product_id);

-- Partners table indexes
CREATE INDEX IF NOT EXISTS idx_partners_is_active ON partners(is_active);
CREATE INDEX IF NOT EXISTS idx_partners_phone ON partners(phone);

-- Complaints table indexes (if exists)
CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);
CREATE INDEX IF NOT EXISTS idx_complaints_user ON complaints(user_id);
CREATE INDEX IF NOT EXISTS idx_complaints_partner ON complaints(partner_id);

-- Feedback table indexes (if exists)
CREATE INDEX IF NOT EXISTS idx_feedback_user ON feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at DESC);

-- Add comment explaining the purpose
COMMENT ON INDEX idx_orders_status IS 'Index for filtering orders by status';
COMMENT ON INDEX idx_orders_zone_id IS 'Index for zone-based order queries';
COMMENT ON INDEX idx_orders_created_at IS 'Index for recent orders';
COMMENT ON INDEX idx_orders_user_status IS 'Composite index for user orders by status';
COMMENT ON INDEX idx_orders_delivery_status IS 'Composite index for daily delivery planning';
