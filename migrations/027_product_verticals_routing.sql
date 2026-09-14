-- Migration for Product Verticals & Multi-Slot Routing Engine

-- Add fulfillment_type column to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS fulfillment_type VARCHAR(50);
COMMENT ON COLUMN orders.fulfillment_type IS 'Fulfillment type: zone_routed, first_claim, manual_assignment, proximity_assignment';

-- Add delivery_slot column to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_slot VARCHAR(50);
COMMENT ON COLUMN orders.delivery_slot IS 'Delivery slot: morning_630_830, mid_morning_1000_1300, evening_600_830';

-- Add parent_order_id column for sub-orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS parent_order_id UUID REFERENCES orders(id) ON DELETE CASCADE;
COMMENT ON COLUMN orders.parent_order_id IS 'Parent order ID for sub-orders in split deliveries';

-- Add claimed_by_vendor_id column for first-to-claim model
ALTER TABLE orders ADD COLUMN IF NOT EXISTS claimed_by_vendor_id UUID REFERENCES partners(id) ON DELETE SET NULL;
COMMENT ON COLUMN orders.claimed_by_vendor_id IS 'Vendor ID for first-to-claim orders (flowers)';

-- Add index for claimed_by_vendor_id
CREATE INDEX IF NOT EXISTS idx_orders_claimed_by_vendor ON orders(claimed_by_vendor_id);

-- Add index for parent_order_id
CREATE INDEX IF NOT EXISTS idx_orders_parent_order ON orders(parent_order_id);

-- Add index for delivery_slot
CREATE INDEX IF NOT EXISTS idx_orders_delivery_slot ON orders(delivery_slot);

-- Add index for fulfillment_type
CREATE INDEX IF NOT EXISTS idx_orders_fulfillment_type ON orders(fulfillment_type);

-- Add delivery_cut_off_time to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_cut_off_time TIMESTAMPTZ;
COMMENT ON COLUMN orders.delivery_cut_off_time IS 'Cut-off time for order acceptance';

-- Add manifest_generated_time to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS manifest_generated_time TIMESTAMPTZ;
COMMENT ON COLUMN orders.manifest_generated_time IS 'Time when delivery manifest was generated';

-- Update products table to include fulfillment requirements
ALTER TABLE products ADD COLUMN IF NOT EXISTS fulfillment_type VARCHAR(50) DEFAULT 'zone_routed';
COMMENT ON COLUMN products.fulfillment_type IS 'Product fulfillment type: zone_routed, first_claim, manual_assignment, proximity_assignment';

ALTER TABLE products ADD COLUMN IF NOT EXISTS delivery_slots VARCHAR(100)[] DEFAULT ARRAY['morning_630_830', 'evening_600_830'];
COMMENT ON COLUMN products.delivery_slots IS 'Available delivery slots for this product';

-- Update existing products with appropriate fulfillment types
UPDATE products SET fulfillment_type = 'zone_routed' WHERE category = 'dairy';
UPDATE products SET fulfillment_type = 'first_claim' WHERE category = 'flowers';
UPDATE products SET fulfillment_type = 'proximity_assignment' WHERE category = 'bakery';
UPDATE products SET fulfillment_type = 'manual_assignment' WHERE category = 'honey';

-- Add terminal delivery status enum
DO $$ BEGIN
    CREATE TYPE terminal_delivery_status AS ENUM ('delivered_doorstep', 'rung_bell', 'handed_over_directly', 'customer_unavailable');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Add terminal_delivery_status to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS terminal_delivery_status terminal_delivery_status;
COMMENT ON COLUMN orders.terminal_delivery_status IS 'Terminal delivery status for milk/paneer orders';

-- Add GPS tracking fields
ALTER TABLE orders ADD COLUMN IF NOT EXISTS gps_tracking_enabled BOOLEAN DEFAULT FALSE;
COMMENT ON COLUMN orders.gps_tracking_enabled IS 'Whether GPS tracking is active for this order';

ALTER TABLE orders ADD COLUMN IF NOT EXISTS live_tracking_started_at TIMESTAMPTZ;
COMMENT ON COLUMN orders.live_tracking_started_at IS 'Timestamp when live GPS tracking started';

ALTER TABLE orders ADD COLUMN IF NOT EXISTS live_tracking_ended_at TIMESTAMPTZ;
COMMENT ON COLUMN orders.live_tracking_ended_at IS 'Timestamp when live GPS tracking ended';

-- Create GPS tracking coordinates table
CREATE TABLE IF NOT EXISTS gps_tracking_coordinates (
    coordinate_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    latitude NUMERIC(10, 8) NOT NULL,
    longitude NUMERIC(11, 8) NOT NULL,
    heading NUMERIC(5, 2),
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gps_tracking_order ON gps_tracking_coordinates(order_id);
CREATE INDEX IF NOT EXISTS idx_gps_tracking_recorded_at ON gps_tracking_coordinates(recorded_at);

-- Add partner_type to partners table
ALTER TABLE partners ADD COLUMN IF NOT EXISTS partner_type VARCHAR(50);
COMMENT ON COLUMN partners.partner_type IS 'Partner type: milk_van, florist, bakery, organic_partner';

-- Update existing partners with appropriate types
UPDATE partners SET partner_type = 'milk_van' WHERE category = 'dairy';
UPDATE partners SET partner_type = 'florist' WHERE category = 'flowers';
UPDATE partners SET partner_type = 'bakery' WHERE category = 'bakery';
UPDATE partners SET partner_type = 'organic_partner' WHERE category = 'honey';

-- Add coverage_radius to partners (for florists)
ALTER TABLE partners ADD COLUMN IF NOT EXISTS coverage_radius_km NUMERIC(5, 2) DEFAULT 5.0;
COMMENT ON COLUMN partners.coverage_radius_km IS 'Coverage radius in kilometers for first-to-claim partners';
