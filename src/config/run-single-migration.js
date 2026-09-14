const fs = require('fs');
const path = require('path');
const { pool } = require('./db');

async function runSingleMigration(filename) {
  const migrationsDir = path.join(__dirname, '../../migrations');
  const filePath = path.join(migrationsDir, filename);
  
  if (!fs.existsSync(filePath)) {
    console.error(`Migration file not found: ${filename}`);
    process.exit(1);
  }

  const sql = fs.readFileSync(filePath, 'utf8');
  console.log(`Running migration: ${filename}`);
  try {
    await pool.query(sql);
    console.log(`  ✓ ${filename} applied successfully`);
  } catch (err) {
    console.error(`  ✗ ${filename} failed:`, err.message);
    process.exit(1);
  }
  await pool.end();
}

const filename = process.argv[2];
if (!filename) {
  console.error('Usage: node run-single-migration.js <migration-file.sql>');
  process.exit(1);
}

runSingleMigration(filename);
