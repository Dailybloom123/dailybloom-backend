const { Pool } = require('pg');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function runMigration() {
  const migrationFile = process.argv[2];
  
  if (!migrationFile) {
    console.error('Please provide migration file name as argument');
    process.exit(1);
  }

  const migrationPath = path.join(__dirname, '../migrations', migrationFile);
  
  if (!fs.existsSync(migrationPath)) {
    console.error(`Migration file not found: ${migrationPath}`);
    process.exit(1);
  }

  const sql = fs.readFileSync(migrationPath, 'utf8');

  try {
    console.log(`Running migration: ${migrationFile}`);
    await pool.query(sql);
    console.log(`✓ Migration completed successfully: ${migrationFile}`);
  } catch (error) {
    console.error(`✗ Migration failed: ${migrationFile}`);
    console.error(error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();