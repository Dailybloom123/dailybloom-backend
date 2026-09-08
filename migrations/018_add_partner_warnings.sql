-- Add partner warning fields for 3-strike policy
ALTER TABLE partners 
ADD COLUMN IF NOT EXISTS warnings INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS warning_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS blocked_reason TEXT,
ADD COLUMN IF NOT EXISTS warning_history JSONB DEFAULT '[]'::jsonb;

-- Index for partner warnings
CREATE INDEX IF NOT EXISTS idx_partners_warnings ON partners(warnings);
CREATE INDEX IF NOT EXISTS idx_partners_active ON partners(is_active);