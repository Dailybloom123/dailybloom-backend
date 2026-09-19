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
    
    // Add partner_id column to order_items table
    await client.query(`
      ALTER TABLE order_items 
      ADD COLUMN IF NOT EXISTS partner_id UUID REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS item_status VARCHAR(50) DEFAULT 'pending'
    `);
    
    // Create indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_order_items_partner_id ON order_items(partner_id)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_order_items_status ON order_items(item_status)
    `);
    
    // Add comments
    await client.query(`
      COMMENT ON COLUMN order_items.partner_id IS 'Snapshot of partner_id at order creation - prevents data corruption when partners are reassigned'
    `);
    
    await client.query(`
      COMMENT ON COLUMN order_items.item_status IS 'Item-level status for partner acceptance/rejection workflow'
    `);
    
    await client.query('COMMIT');
    console.log('✅ Migration 031 completed successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration 031 failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch(console.error);
