-- Add partner_code field for human-readable partner IDs
-- This allows partners to login using a memorable code instead of UUID

ALTER TABLE partners ADD COLUMN IF NOT EXISTS partner_code VARCHAR(20) UNIQUE;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS blocked_reason TEXT;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS warnings INTEGER DEFAULT 0;

-- Create index for partner code lookups
CREATE INDEX IF NOT EXISTS idx_partners_code ON partners(partner_code);

-- Add unique constraint to ensure partner codes are unique across all partners
ALTER TABLE partners ADD CONSTRAINT unique_partner_code UNIQUE (partner_code);