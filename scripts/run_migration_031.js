const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log('Starting migration 031: WhatsApp Conversations...');
    const migrationPath = path.join(__dirname, '../migrations/031_whatsapp_conversations.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    await client.query('BEGIN');
    await client.query(migrationSQL);
    await client.query('COMMIT');

    console.log('✅ Migration 031 completed successfully!');
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
