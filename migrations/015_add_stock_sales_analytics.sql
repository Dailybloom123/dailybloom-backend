-- Stock management and sales analytics tables
CREATE TABLE IF NOT EXISTS inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  category VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  unit VARCHAR(50) NOT NULL, -- liters, pieces, bottles, stems, etc.
  reorder_level INTEGER NOT NULL DEFAULT 10,
  last_restocked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sales analytics by locality
CREATE TABLE IF NOT EXISTS sales_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  locality VARCHAR(100) NOT NULL,
  city VARCHAR(100) NOT NULL,
  pincode VARCHAR(10),
  total_amount NUMERIC(10, 2) NOT NULL,
  items_count INTEGER NOT NULL,
  sale_date DATE NOT NULL DEFAULT CURRENT_DATE,
  sale_period VARCHAR(20) NOT NULL, -- 'weekly' or 'monthly'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_inventory_product ON inventory(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_category ON inventory(category);
CREATE INDEX IF NOT EXISTS idx_sales_analytics_locality ON sales_analytics(locality);
CREATE INDEX IF NOT EXISTS idx_sales_analytics_date ON sales_analytics(sale_date);
CREATE INDEX IF NOT EXISTS idx_sales_analytics_period ON sales_analytics(sale_period);

-- Trigger to update inventory when orders are placed
CREATE OR REPLACE FUNCTION update_inventory_on_order()
RETURNS TRIGGER AS $$
BEGIN
  -- Update inventory for each item in the order
  -- This would need to be expanded based on order_items table structure
  NEW.stock_quantity = NEW.stock_quantity - 1;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate daily sales by locality
CREATE OR REPLACE FUNCTION calculate_daily_sales()
RETURNS void AS $$
BEGIN
  -- This function would aggregate sales data by locality for the day
  -- To be called by a scheduled job
  INSERT INTO sales_analytics (order_id, locality, city, pincode, total_amount, items_count, sale_date, sale_period)
  SELECT 
    o.id,
    a.locality,
    a.city,
    a.pincode,
    o.total,
    (SELECT COUNT(*) FROM order_items WHERE order_id = o.id),
    CURRENT_DATE,
    'daily'
  FROM orders o
  JOIN addresses a ON o.address_id = a.id
  WHERE o.created_at::date = CURRENT_DATE
  ON CONFLICT (order_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql;