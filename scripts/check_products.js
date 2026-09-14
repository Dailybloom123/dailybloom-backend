const db = require('../src/config/db');

db.query('SELECT column_name, data_type FROM information_schema.columns WHERE table_name = \'products\' ORDER BY ordinal_position')
  .then(result => {
    console.log('Products table columns:');
    result.rows.forEach(row => console.log(`  ${row.column_name}: ${row.data_type}`));
    return db.query('SELECT COUNT(*) as count FROM products');
  })
  .then(result => {
    console.log('\nProducts in database:', result.rows[0].count);
    return db.query('SELECT id, name FROM products LIMIT 5');
  })
  .then(result => {
    console.log('\nSample products:');
    result.rows.forEach(row => console.log(`  ${row.id}: ${row.name}`));
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });