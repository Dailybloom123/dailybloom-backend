-- Add password_hash column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_attempts INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;

-- Add password_hash column to partners table
ALTER TABLE partners ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
ALTER TABLE partners ADD COLUMN IF NOT EXISTS failed_attempts INTEGER DEFAULT 0;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;

-- Create indexes for password management
CREATE INDEX IF NOT EXISTS idx_users_failed_attempts ON users(failed_attempts);
CREATE INDEX IF NOT EXISTS idx_partners_failed_attempts ON partners(failed_attempts);