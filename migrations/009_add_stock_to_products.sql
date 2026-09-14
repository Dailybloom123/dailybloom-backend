-- Add stock management to products table
-- This enables inventory tracking and prevents overselling

-- Add stock column to products table
ALTER TABLE products 
ADD COLUMN stock INT NOT NULL DEFAULT 0,
ADD COLUMN stock_reserved INT NOT NULL DEFAULT 0;

-- Add index for stock queries
CREATE INDEX idx_products_stock ON products(stock, is_active);

-- Update existing products to have reasonable default stock
UPDATE products SET stock = 100 WHERE stock = 0;
