const db = require('./src/config/db');

async function runMigrations() {
  console.log('Running migrations...');
  
  try {
    // Migration 009: Add stock columns to products
    console.log('Running migration 009: Add stock columns to products...');
    await db.query(`
      ALTER TABLE products 
      ADD COLUMN IF NOT EXISTS stock INT NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS stock_reserved INT NOT NULL DEFAULT 0
    `);
    console.log('✓ Stock columns added');
    
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_products_stock ON products(stock, is_active)
    `);
    console.log('✓ Stock index created');
    
    await db.query(`
      UPDATE products SET stock = 100 WHERE stock = 0
    `);
    console.log('✓ Existing products updated with stock = 100');
    
    // Migration 010: Add notifications table
    console.log('Running migration 010: Add notifications table...');
    await db.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        title VARCHAR(200) NOT NULL,
        message TEXT NOT NULL,
        related_order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
        related_product_id UUID REFERENCES products(id) ON DELETE CASCADE,
        is_read BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    console.log('✓ Notifications table created');
    
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read, created_at DESC)
    `);
    console.log('✓ User notifications index created');
    
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_notifications_order ON notifications(related_order_id)
    `);
    console.log('✓ Order notifications index created');
    
    console.log('\n✅ All migrations completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

runMigrations();
