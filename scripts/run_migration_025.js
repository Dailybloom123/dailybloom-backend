const fs = require('fs');
const db = require('../src/config/db');

async function runMigration() {
  console.log('Running migration 025: Add mock products...\n');

  try {
    const migrationSQL = fs.readFileSync('./migrations/025_add_mock_products.sql', 'utf8');
    
    // Split by semicolon and execute each statement
    const statements = migrationSQL.split(';').filter(s => s.trim());
    
    for (const statement of statements) {
      if (statement.trim()) {
        await db.query(statement.trim());
        console.log('Executed statement successfully');
      }
    }
    
    console.log('\nMigration completed successfully!');
    
    // Verify products were added
    const result = await db.query('SELECT COUNT(*) as count FROM products');
    console.log(`Total products in database: ${result.rows[0].count}`);
    
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  }
}

runMigration();