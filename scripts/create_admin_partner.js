const bcrypt = require('bcrypt');
const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function createAdminAndPartner() {
  const adminPassword = 'Admin@123';
  const partnerPassword = 'Partner@123';

  // Hash passwords
  const adminPasswordHash = await bcrypt.hash(adminPassword, 10);
  const partnerPasswordHash = await bcrypt.hash(partnerPassword, 10);

  console.log('Creating admin user...');
  try {
    // Check if admin already exists
    const adminCheck = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      ['admin@dailybloom.com']
    );

    if (adminCheck.rows.length > 0) {
      // Update existing admin
      await pool.query(
        `UPDATE users 
         SET name = $1, password_hash = $2, role = $3, updated_at = NOW() 
         WHERE email = $4`,
        ['Admin User', adminPasswordHash, 'admin', 'admin@dailybloom.com']
      );
      console.log('✅ Admin user updated');
    } else {
      // Create new admin
      await pool.query(
        `INSERT INTO users (id, name, email, password_hash, role, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW(), NOW())`,
        ['Admin User', 'admin@dailybloom.com', adminPasswordHash, 'admin']
      );
      console.log('✅ Admin user created');
    }
  } catch (err) {
    console.error('❌ Error creating admin:', err.message);
  }

  console.log('\nCreating partner user...');
  try {
    // Check if partner already exists
    const partnerCheck = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      ['partner@dailybloom.com']
    );

    if (partnerCheck.rows.length > 0) {
      // Update existing partner
      await pool.query(
        `UPDATE users 
         SET name = $1, password_hash = $2, role = $3, partner_type = $4, updated_at = NOW() 
         WHERE email = $5`,
        ['Partner User', partnerPasswordHash, 'vendor', 'milk_van', 'partner@dailybloom.com']
      );
      console.log('✅ Partner user updated');
    } else {
      // Create new partner
      await pool.query(
        `INSERT INTO users (id, name, email, password_hash, role, partner_type, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NOW(), NOW())`,
        ['Partner User', 'partner@dailybloom.com', partnerPasswordHash, 'vendor', 'milk_van']
      );
      console.log('✅ Partner user created');
    }
  } catch (err) {
    console.error('❌ Error creating partner:', err.message);
  }

  console.log('\n=== Login Credentials ===');
  console.log('Admin Login:');
  console.log('  Email: admin@dailybloom.com');
  console.log('  Password: Admin@123');
  console.log('\nPartner Login:');
  console.log('  Email: partner@dailybloom.com');
  console.log('  Password: Partner@123');

  await pool.end();
}

createAdminAndPartner().catch(console.error);
