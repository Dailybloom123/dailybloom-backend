-- Update complaints table for partner routing and strike system
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS partner_id UUID REFERENCES partners(id) ON DELETE SET NULL;
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS escalation_level INTEGER DEFAULT 0 CHECK (escalation_level >= 0 AND escalation_level <= 5);
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS is_partner_notified BOOLEAN DEFAULT FALSE;
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS admin_whatsapp_notified BOOLEAN DEFAULT FALSE;

-- Create partner warnings table for 5-strike system
CREATE TABLE IF NOT EXISTS partner_warnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  complaint_id UUID REFERENCES complaints(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  severity VARCHAR(20) DEFAULT 'warning' CHECK (severity IN ('warning', 'strike', 'critical')),
  strike_count INTEGER DEFAULT 1 CHECK (strike_count >= 1 AND strike_count <= 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  notes TEXT
);

-- Add is_active field to partners for banning after 5 strikes
ALTER TABLE partners ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS total_strikes INTEGER DEFAULT 0;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS banned_at TIMESTAMPTZ;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS ban_reason TEXT;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_complaints_partner_id ON complaints(partner_id);
CREATE INDEX IF NOT EXISTS idx_complaints_escalation ON complaints(escalation_level);
CREATE INDEX IF NOT EXISTS idx_partner_warnings_partner_id ON partner_warnings(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_warnings_severity ON partner_warnings(severity);
CREATE INDEX IF NOT EXISTS idx_partners_active ON partners(is_active);

-- Add trigger to auto-ban partners after 5 strikes
CREATE OR REPLACE FUNCTION check_partner_strike_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.strike_count >= 5 THEN
    UPDATE partners 
    SET is_active = false, 
        total_strikes = NEW.strike_count,
        banned_at = now(),
        ban_reason = 'Exceeded maximum strike limit (5 strikes)'
    WHERE id = NEW.partner_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_check_strike_limit
AFTER INSERT ON partner_warnings
FOR EACH ROW
EXECUTE FUNCTION check_partner_strike_limit();