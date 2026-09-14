-- Wallet System Migration - Double-Entry Ledger Architecture
-- This migration creates the wallet tables with proper constraints and indexes

-- Create user_wallets table
CREATE TABLE IF NOT EXISTS user_wallets (
  wallet_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  balance NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (balance >= 0.00),
  currency VARCHAR(3) NOT NULL DEFAULT 'INR',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for user_wallets
CREATE INDEX IF NOT EXISTS idx_user_wallets_user_id ON user_wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_user_wallets_is_active ON user_wallets(is_active);

-- Create transaction_type enum
DO $$ BEGIN
  CREATE TYPE transaction_type AS ENUM ('CREDIT_TOPUP', 'DEBIT_ORDER', 'CREDIT_REFUND', 'DEBIT_ADJUSTMENT', 'DEBIT_WITHDRAWAL');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Create transaction_status enum
DO $$ BEGIN
  CREATE TYPE transaction_status AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'PROCESSING');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Create wallet_transactions table (ledger)
CREATE TABLE IF NOT EXISTS wallet_transactions (
  transaction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES user_wallets(wallet_id) ON DELETE CASCADE,
  amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0.00),
  type transaction_type NOT NULL,
  status transaction_status NOT NULL DEFAULT 'PENDING',
  reference_order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  reference_payment_id VARCHAR(255),
  balance_after NUMERIC(10, 2) NOT NULL,
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_payment_reference UNIQUE (reference_payment_id)
);

-- Create indexes for wallet_transactions
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet_id ON wallet_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_type ON wallet_transactions(type);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_status ON wallet_transactions(status);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_reference_order_id ON wallet_transactions(reference_order_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_created_at ON wallet_transactions(created_at DESC);

-- Create withdrawal_requests table
CREATE TABLE IF NOT EXISTS withdrawal_requests (
  request_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wallet_id UUID NOT NULL REFERENCES user_wallets(wallet_id) ON DELETE CASCADE,
  amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0.00),
  bank_account_name VARCHAR(255) NOT NULL,
  bank_account_number VARCHAR(50) NOT NULL,
  bank_ifsc_code VARCHAR(20) NOT NULL,
  bank_name VARCHAR(255),
  status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  rejection_reason TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for withdrawal_requests
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_user_id ON withdrawal_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status ON withdrawal_requests(status);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_created_at ON withdrawal_requests(created_at DESC);

-- Create subscription_pauses table
CREATE TABLE IF NOT EXISTS subscription_pauses (
  pause_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT valid_date_range CHECK (end_date >= start_date)
);

-- Create indexes for subscription_pauses
CREATE INDEX IF NOT EXISTS idx_subscription_pauses_subscription_id ON subscription_pauses(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_pauses_date_range ON subscription_pauses(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_subscription_pauses_active ON subscription_pauses(start_date, end_date)
  WHERE end_date >= CURRENT_DATE;

-- Add trigger to update updated_at on user_wallets
CREATE OR REPLACE FUNCTION update_wallet_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_wallet_updated_at ON user_wallets;
CREATE TRIGGER trigger_update_wallet_updated_at
  BEFORE UPDATE ON user_wallets
  FOR EACH ROW
  EXECUTE FUNCTION update_wallet_updated_at();

-- Add trigger to update updated_at on withdrawal_requests
CREATE OR REPLACE FUNCTION update_withdrawal_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_withdrawal_updated_at ON withdrawal_requests;
CREATE TRIGGER trigger_update_withdrawal_updated_at
  BEFORE UPDATE ON withdrawal_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_withdrawal_updated_at();

-- Add comment to tables
COMMENT ON TABLE user_wallets IS 'User wallet balances - one wallet per user';
COMMENT ON TABLE wallet_transactions IS 'Wallet transaction ledger - immutable audit trail';
COMMENT ON TABLE withdrawal_requests IS 'Wallet withdrawal requests to bank accounts';
COMMENT ON TABLE subscription_pauses IS 'Subscription vacation/pause periods';
