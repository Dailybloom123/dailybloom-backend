const db = require('../src/config/db');

db.query('SELECT column_name, data_type FROM information_schema.columns WHERE table_name = \'addresses\' ORDER BY ordinal_position')
  .then(result => {
    console.log('Addresses table columns:');
    result.rows.forEach(row => console.log(`  ${row.column_name}: ${row.data_type}`));
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });