const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkSchema() {
  try {
    console.log('Checking addresses table schema...');
    
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'addresses'
      ORDER BY ordinal_position;
    `);
    
    console.log('\n✅ Addresses table columns:');
    result.rows.forEach(column => {
      console.log(`  - ${column.column_name}: ${column.data_type} (nullable: ${column.is_nullable})`);
    });
    
    // Check for our new columns
    const requiredColumns = [
      'ordering_for', 'recipient_name', 'recipient_phone', 
      'address_type', 'custom_address_type', 'flat_house_number',
      'street_building_society', 'landmark'
    ];
    
    const existingColumns = result.rows.map(row => row.column_name);
    const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));
    
    if (missingColumns.length > 0) {
      console.log('\n❌ Missing columns:', missingColumns);
    } else {
      console.log('\n✅ All required columns are present');
    }
    
  } catch (error) {
    console.error('❌ Error checking schema:', error.message);
  } finally {
    await pool.end();
  }
}

checkSchema();