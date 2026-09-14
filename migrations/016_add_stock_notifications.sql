-- Stock notifications table for Partner ↔ Admin communication
CREATE TABLE IF NOT EXISTS stock_notifications (
  id SERIAL PRIMARY KEY,
  partner_id UUID NOT NULL,
  type VARCHAR(50) NOT NULL, -- 'low_stock', 'stock_request', 'reorder_request', 'other'
  message TEXT NOT NULL,
  product_id UUID,
  quantity INTEGER,
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'reviewed', 'approved', 'rejected'
  admin_response TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE CASCADE
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_stock_notifications_partner_id ON stock_notifications(partner_id);
CREATE INDEX IF NOT EXISTS idx_stock_notifications_status ON stock_notifications(status);
CREATE INDEX IF NOT EXISTS idx_stock_notifications_created_at ON stock_notifications(created_at DESC);

-- Add reorder_level column to products table if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'reorder_level'
  ) THEN
    ALTER TABLE products ADD COLUMN reorder_level INTEGER DEFAULT 10;
  END IF;
END $$;