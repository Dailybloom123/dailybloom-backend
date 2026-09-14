-- Partner Payouts System Migration
-- This migration adds tables and columns for managing partner profit sharing

-- Add partner bank details to partners table
ALTER TABLE partners ADD COLUMN IF NOT EXISTS bank_account_name VARCHAR(255);
ALTER TABLE partners ADD COLUMN IF NOT EXISTS bank_account_number VARCHAR(50);
ALTER TABLE partners ADD COLUMN IF NOT EXISTS bank_ifsc_code VARCHAR(20);
ALTER TABLE partners ADD COLUMN IF NOT EXISTS bank_account_type VARCHAR(50) DEFAULT 'savings'; -- savings, current
ALTER TABLE partners ADD COLUMN IF NOT EXISTS payout_percentage DECIMAL(5,2) DEFAULT 85.00; -- Default 85% for partner, 15% for DailyBloom
ALTER TABLE partners ADD COLUMN IF NOT EXISTS minimum_payout_amount DECIMAL(10,2) DEFAULT 500.00; -- Minimum amount to trigger payout
ALTER TABLE partners ADD COLUMN IF NOT EXISTS payout_frequency VARCHAR(20) DEFAULT 'weekly'; -- daily, weekly, monthly
ALTER TABLE partners ADD COLUMN IF NOT EXISTS last_payout_date TIMESTAMP;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS total_earnings DECIMAL(12,2) DEFAULT 0.00;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS pending_payout DECIMAL(12,2) DEFAULT 0.00;

-- Create partner_payouts table for tracking payouts
CREATE TABLE IF NOT EXISTS partner_payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    order_total DECIMAL(10,2) NOT NULL,
    partner_share DECIMAL(10,2) NOT NULL,
    dailybloom_share DECIMAL(10,2) NOT NULL,
    payout_percentage DECIMAL(5,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- pending, processing, completed, failed
    processed_at TIMESTAMP,
    utr_number VARCHAR(50), -- UTR reference for bank transfer
    remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_partner_payouts_partner_id ON partner_payouts(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_payouts_order_id ON partner_payouts(order_id);
CREATE INDEX IF NOT EXISTS idx_partner_payouts_status ON partner_payouts(status);
CREATE INDEX IF NOT EXISTS idx_partner_payouts_created_at ON partner_payouts(created_at);

-- Add commission tracking to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS partner_id UUID REFERENCES partners(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS commission_amount DECIMAL(10,2) DEFAULT 0.00;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS partner_payout_id UUID REFERENCES partner_payouts(id) ON DELETE SET NULL;

-- Create payout_requests table for bulk payout processing
CREATE TABLE IF NOT EXISTS payout_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
    total_amount DECIMAL(10,2) NOT NULL,
    order_count INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- pending, approved, processing, completed, failed
    requested_by UUID REFERENCES admins(id),
    approved_by UUID REFERENCES admins(id),
    approved_at TIMESTAMP,
    processed_at TIMESTAMP,
    bank_account_name VARCHAR(255),
    bank_account_number VARCHAR(50),
    bank_ifsc_code VARCHAR(20),
    utr_number VARCHAR(50),
    remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for payout requests
CREATE INDEX IF NOT EXISTS idx_payout_requests_partner_id ON payout_requests(partner_id);
CREATE INDEX IF NOT EXISTS idx_payout_requests_status ON payout_requests(status);
CREATE INDEX IF NOT EXISTS idx_payout_requests_created_at ON payout_requests(created_at);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_partner_payouts_updated_at BEFORE UPDATE ON partner_payouts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payout_requests_updated_at BEFORE UPDATE ON payout_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();