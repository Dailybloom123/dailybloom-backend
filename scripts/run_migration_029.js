const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false // Disable SSL for local development
});

async function runMigration() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Generate UUID for test partner
    const partnerId = uuidv4();
    
    // Hash the password
    const hashedPassword = await bcrypt.hash('DailyBloom@123', 10);
    
    // Insert test partner
    const insertPartner = `
      INSERT INTO users (id, email, password, name, phone, role, partner_type, is_active, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
      ON CONFLICT (email) DO UPDATE SET
        password = $3,
        updated_at = NOW()
      RETURNING id, email;
    `;
    
    const result = await client.query(insertPartner, [
      partnerId,
      'partner@dailybloom.com',
      hashedPassword,
      'Test Partner',
      '+919876543210',
      'vendor',
      'milk_van',
      true
    ]);
    
    await client.query('COMMIT');
    
    console.log('✅ Migration 029 completed successfully');
    console.log('📧 Test Partner Email: partner@dailybloom.com');
    console.log('🔑 Test Partner Password: DailyBloom@123');
    console.log('🆔 Partner ID:', result.rows[0].id);
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
