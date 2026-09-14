const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log('Starting migration 029: RBAC Roles...');
    const migrationPath = path.join(__dirname, '../migrations/029_rbac_roles.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    await client.query('BEGIN');
    await client.query(migrationSQL);
    await client.query('COMMIT');

    console.log('✅ Migration 029 completed successfully!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration 029 failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch(console.error);
