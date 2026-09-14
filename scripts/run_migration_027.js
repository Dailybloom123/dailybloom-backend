const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function runMigration() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    console.log('Running migration 027: Product Verticals & Multi-Slot Routing Engine...');
    
    // Read and execute the migration SQL
    const fs = require('fs');
    const path = require('path');
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, '../migrations/027_product_verticals_routing.sql'),
      'utf8'
    );
    
    await client.query(migrationSQL);
    
    console.log('✓ Migration 027 completed successfully');
    
    await client.query('COMMIT');
    console.log('✓ Database updated for product verticals and routing engine');
    
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
