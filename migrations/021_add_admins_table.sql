-- Create proper admins table for database-based authentication
CREATE TABLE IF NOT EXISTS admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(150) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(150) NOT NULL,
  phone VARCHAR(15),
  is_active BOOLEAN NOT NULL DEFAULT true,
  failed_attempts INTEGER DEFAULT 0,
  locked_until TIMESTAMPTZ,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index for email lookups
CREATE INDEX IF NOT EXISTS idx_admins_email ON admins(email);
CREATE INDEX IF NOT EXISTS idx_admins_active ON admins(is_active);

-- Insert default admin with secure password (password: admin123)
-- In production, this should be done through a secure setup script
INSERT INTO admins (email, password_hash, name, phone, is_active)
VALUES (
  'admin@dailybloom.com',
  '$2a$10$JCGgN4rxWqcP6D43qpQrF.oQNNtRnLROLLe/NOeHRn4eaEhBYdYee',
  'DailyBloom Admin',
  '919910217309',
  true
)
ON CONFLICT (email) DO NOTHING;