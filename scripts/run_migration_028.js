const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') || process.env.DATABASE_URL?.includes('127.0.0.1') ? false : { rejectUnauthorized: false }
});

async function runMigration() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const migrationSQL = `
-- Migration 028: Add partner_id foreign key to products table
-- This establishes the relationship between products and partners

-- Add partner_id column to products table
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS partner_id UUID REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_products_partner_id ON products(partner_id);
CREATE INDEX IF NOT EXISTS idx_products_vendor_id ON products(vendor_id);

-- Add comment
COMMENT ON COLUMN products.partner_id IS 'Foreign key to the partner (vendor) who owns this product';
COMMENT ON COLUMN products.vendor_id IS 'Foreign key to the vendor account (alternative to partner_id)';
    `;
    
    await client.query(migrationSQL);
    await client.query('COMMIT');
    console.log('✅ Migration 028 completed successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration 028 failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch(console.error);
