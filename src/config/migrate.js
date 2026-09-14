// Simple migration runner: executes every .sql file in /migrations, in order.
// Run with: npm run migrate
const fs = require('fs');
const path = require('path');
const { pool } = require('./db');

async function runMigrations() {
  const migrationsDir = path.join(__dirname, '../../migrations');
  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();

  console.log(`Found ${files.length} migration file(s).`);

  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf8');
    console.log(`Running migration: ${file}`);
    try {
      await pool.query(sql);
      console.log(`  ✓ ${file} applied`);
    } catch (err) {
      console.error(`  ✗ ${file} failed:`, err.message);
      process.exit(1);
    }
  }

  console.log('All migrations applied successfully.');
  await pool.end();
}

runMigrations();
