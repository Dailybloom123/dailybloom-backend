const bcrypt = require('bcryptjs');

async function generateHashes() {
  const adminPassword = 'Admin@123';
  const partnerPassword = 'Partner@123';

  const adminHash = await bcrypt.hash(adminPassword, 10);
  const partnerHash = await bcrypt.hash(partnerPassword, 10);

  console.log('=== BCRYPT HASHES ===\n');
  console.log('Admin Password Hash:');
  console.log(adminHash);
  console.log('\nPartner Password Hash:');
  console.log(partnerHash);
  console.log('\n=== SQL TO RUN ===\n');
  console.log('-- Delete existing users');
  console.log("DELETE FROM users WHERE email = 'admin@dailybloom.com';");
  console.log("DELETE FROM users WHERE email = 'partner@dailybloom.com';");
  console.log('\n-- Create admin user (password: Admin@123)');
  console.log(`INSERT INTO users (id, name, email, password_hash, role, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'Admin User',
  'admin@dailybloom.com',
  '${adminHash}',
  'admin',
  NOW(),
  NOW()
);`);
  console.log('\n-- Create partner user (password: Partner@123)');
  console.log(`INSERT INTO users (id, name, email, password_hash, role, partner_type, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'Partner User',
  'partner@dailybloom.com',
  '${partnerHash}',
  'vendor',
  'milk_van',
  NOW(),
  NOW()
);`);
}

generateHashes().catch(console.error);
