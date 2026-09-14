-- Add sub_status column to orders table for detailed order status flow
-- This supports sub-stages: packed, ready_for_dispatch, out_for_delivery

ALTER TABLE orders ADD COLUMN IF NOT EXISTS sub_status VARCHAR(50);

-- Add comment to document the new column
COMMENT ON COLUMN orders.sub_status IS 'Sub-status for detailed order tracking when status is in_progress. Valid values: packed, ready_for_dispatch, out_for_delivery';

-- Update existing orders to have consistent status
UPDATE orders SET sub_status = NULL WHERE sub_status IS NULL;

-- Create index for faster queries on sub_status
CREATE INDEX IF NOT EXISTS idx_orders_sub_status ON orders(sub_status);
