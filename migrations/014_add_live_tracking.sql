-- Live delivery tracking system for real-time location updates
CREATE TABLE IF NOT EXISTS delivery_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  partner_id UUID REFERENCES partners(id) ON DELETE SET NULL,
  latitude NUMERIC(10, 8) NOT NULL,
  longitude NUMERIC(11, 8) NOT NULL,
  accuracy NUMERIC(10, 2), -- GPS accuracy in meters
  speed NUMERIC(10, 2), -- Speed in km/h
  heading NUMERIC(10, 2), -- Direction in degrees
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  tracking_status VARCHAR(20) DEFAULT 'active' CHECK (tracking_status IN ('active', 'paused', 'completed'))
);

-- Table for delivery milestones (Zomato-style progress updates)
CREATE TABLE IF NOT EXISTS delivery_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  milestone_type VARCHAR(30) NOT NULL CHECK (milestone_type IN ('picked_up', 'on_the_way', 'nearby', 'at_location')),
  latitude NUMERIC(10, 8),
  longitude NUMERIC(11, 8),
  estimated_arrival TIMESTAMPTZ,
  actual_arrival TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add tracking fields to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_enabled BOOLEAN DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS live_tracking_started_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS live_tracking_ended_at TIMESTAMPTZ;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_delivery_tracking_order ON delivery_tracking(order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_tracking_partner ON delivery_tracking(partner_id);
CREATE INDEX IF NOT EXISTS idx_delivery_tracking_timestamp ON delivery_tracking(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_delivery_milestones_order ON delivery_milestones(order_id);
CREATE INDEX IF NOT EXISTS idx_orders_tracking_enabled ON orders(tracking_enabled) WHERE tracking_enabled = true;

-- Create function to clean up old tracking data (keep only last 24 hours)
CREATE OR REPLACE FUNCTION cleanup_old_tracking_data()
RETURNS void AS $$
BEGIN
  DELETE FROM delivery_tracking 
  WHERE timestamp < now() - interval '24 hours';
  
  DELETE FROM delivery_milestones 
  WHERE created_at < now() - interval '7 days';
END;
$$ LANGUAGE plpgsql;