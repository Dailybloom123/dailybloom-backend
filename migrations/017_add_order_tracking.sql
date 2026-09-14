-- Order status history table for tracking order timeline
CREATE TABLE IF NOT EXISTS order_status_history (
  id SERIAL PRIMARY KEY,
  order_id UUID NOT NULL,
  status VARCHAR(50) NOT NULL,
  notes TEXT,
  changed_by UUID,
  changed_by_role VARCHAR(20) NOT NULL, -- 'admin', 'partner', 'system'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_order_status_history_order_id ON order_status_history(order_id);
CREATE INDEX IF NOT EXISTS idx_order_status_history_created_at ON order_status_history(created_at DESC);

-- Add columns to orders table for tracking
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'assigned_partner_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN assigned_partner_id UUID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'estimated_delivery_time'
  ) THEN
    ALTER TABLE orders ADD COLUMN estimated_delivery_time TIMESTAMP;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'current_location'
  ) THEN
    ALTER TABLE orders ADD COLUMN current_location TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'notes'
  ) THEN
    ALTER TABLE orders ADD COLUMN notes TEXT;
  END IF;
END $$;

-- Add foreign key for assigned partner
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'orders_assigned_partner_id_fkey'
  ) THEN
    ALTER TABLE orders 
    ADD CONSTRAINT orders_assigned_partner_id_fkey 
    FOREIGN KEY (assigned_partner_id) REFERENCES partners(id) ON DELETE SET NULL;
  END IF;
END $$;