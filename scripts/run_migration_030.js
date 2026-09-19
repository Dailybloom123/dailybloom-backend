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
    
    // Create sequence for display order IDs
    await client.query(`
      CREATE SEQUENCE IF NOT EXISTS display_order_id_seq
        START WITH 1001
        INCREMENT BY 1
        NO MINVALUE
        NO MAXVALUE
        CACHE 1
    `);
    
    // Add display_order_id column (no default - will be set in application code)
    await client.query(`
      ALTER TABLE orders 
      ADD COLUMN IF NOT EXISTS display_order_id VARCHAR(20) UNIQUE
    `);
    
    // Create index
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_orders_display_order_id ON orders(display_order_id)
    `);
    
    // Add comments
    await client.query(`
      COMMENT ON COLUMN orders.display_order_id IS 'Human-readable display order ID (e.g., DB-1001) for customer-facing UI'
    `);
    
    await client.query(`
      COMMENT ON SEQUENCE display_order_id_seq IS 'Sequence for generating human-readable order IDs'
    `);
    
    await client.query('COMMIT');
    console.log('✅ Migration 030 completed successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration 030 failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch(console.error);
