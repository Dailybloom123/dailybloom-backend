const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function runMigration() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    console.log('Running migration 026: Add order sub_status column...');
    
    // Add sub_status column to orders table
    await client.query(`
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS sub_status VARCHAR(50);
    `);
    
    console.log('✓ Added sub_status column to orders table');
    
    // Add comment
    await client.query(`
      COMMENT ON COLUMN orders.sub_status IS 'Sub-status for detailed order tracking when status is in_progress. Valid values: packed, ready_for_dispatch, out_for_delivery';
    `);
    
    console.log('✓ Added comment to sub_status column');
    
    // Create index
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_orders_sub_status ON orders(sub_status);
    `);
    
    console.log('✓ Created index on sub_status column');
    
    await client.query('COMMIT');
    console.log('✓ Migration 026 completed successfully');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
