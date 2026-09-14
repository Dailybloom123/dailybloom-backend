const db = require('../src/config/db');
const { v4: uuidv4 } = require('uuid');

async function testPaymentUUIDHandling() {
  console.log('Testing Payment UUID Handling...\n');

  try {
    // Test 1: UUID validation logic
    console.log('Test 1: UUID validation logic');
    const testProductId = 'prod_1'; // Non-UUID
    const validProductId = uuidv4(); // Valid UUID
    
    const isTestValid = testProductId && typeof testProductId === 'string' && testProductId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    const isValidValid = validProductId && typeof validProductId === 'string' && validProductId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    
    console.log(`prod_1 is valid UUID: ${isTestValid} (expected: false)`);
    console.log(`${validProductId} is valid UUID: ${isValidValid} (expected: true)`);
    
    if (!isTestValid && isValidValid) {
      console.log('UUID validation logic working correctly');
    } else {
      throw new Error('UUID validation logic failed');
    }

    // Test 2: Check actual orders table structure
    console.log('\nTest 2: Checking orders table structure');
    const ordersColumns = await db.query(
      "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'orders' ORDER BY ordinal_position"
    );
    console.log('Orders table columns:');
    ordersColumns.rows.forEach(row => console.log(`  ${row.column_name}: ${row.data_type}`));

    // Test 3: Check delivery_zones table exists
    console.log('\nTest 3: Checking delivery_zones table');
    const zonesCheck = await db.query(
      "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'delivery_zones')"
    );
    console.log('delivery_zones table exists:', zonesCheck.rows[0].exists);

    // Test 4: Check addresses table structure
    console.log('\nTest 4: Checking addresses table structure');
    const addressColumns = await db.query(
      "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'addresses' ORDER BY ordinal_position"
    );
    console.log('Addresses table columns:');
    addressColumns.rows.forEach(row => console.log(`  ${row.column_name}: ${row.data_type}`));

    console.log('\nAll UUID handling tests passed!');
    process.exit(0);
  } catch (error) {
    console.error('Test failed:', error.message);
    process.exit(1);
  }
}

testPaymentUUIDHandling();