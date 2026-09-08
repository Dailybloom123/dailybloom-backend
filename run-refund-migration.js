const db = require('./src/config/db');

async function runRefundMigration() {
  console.log('Running refund migration...');
  
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS refunds (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        amount NUMERIC(10,2) NOT NULL,
        reason TEXT,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        razorpay_refund_id VARCHAR(100),
        rejection_reason TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    console.log('✓ Refunds table created');
    
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_refunds_order ON refunds(order_id)
    `);
    console.log('✓ Order refund index created');
    
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_refunds_user ON refunds(user_id, status)
    `);
    console.log('✓ User refund index created');
    
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_refunds_status ON refunds(status)
    `);
    console.log('✓ Status refund index created');
    
    console.log('\n✅ Refund migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Refund migration failed:', error.message);
    process.exit(1);
  }
}

runRefundMigration();
