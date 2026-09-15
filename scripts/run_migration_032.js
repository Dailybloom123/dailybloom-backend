require('dotenv').config();
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log('Running migration 032: Add performance indexes...');
    
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, '..', 'migrations', '032_add_performance_indexes.sql'),
      'utf8'
    );
    
    await client.query(migrationSQL);
    console.log('✅ Migration 032 completed successfully');
  } catch (error) {
    console.error('❌ Migration 032 failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch(console.error);
