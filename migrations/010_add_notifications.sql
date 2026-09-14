-- Add notifications table for customer notifications
-- This enables notifying customers about out-of-stock items and other events

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL, -- 'out_of_stock', 'order_update', etc.
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  related_order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  related_product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for efficient queries
CREATE INDEX idx_notifications_user ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX idx_notifications_order ON notifications(related_order_id);
