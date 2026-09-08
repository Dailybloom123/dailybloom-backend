-- DailyBloom database schema
-- Run this against your PostgreSQL database to set up all tables.

CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- for gen_random_uuid()

-- Delivery zones: the geographic areas the app operates in.
-- Everything else (vendors, addresses, orders) belongs to a zone.
CREATE TABLE delivery_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  pincode VARCHAR(10),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Customers
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone VARCHAR(15) UNIQUE NOT NULL,
  name VARCHAR(100),
  email VARCHAR(150),
  password_hash VARCHAR(255), -- nullable: OTP-only login is fine without a password
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Saved delivery addresses per user
CREATE TABLE addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  zone_id UUID NOT NULL REFERENCES delivery_zones(id),
  label VARCHAR(50), -- e.g. "Home", "Office"
  line1 VARCHAR(255) NOT NULL,
  line2 VARCHAR(255),
  city VARCHAR(100),
  pincode VARCHAR(10),
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Local sellers: dairies, florists, potters, etc.
CREATE TABLE vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(150) NOT NULL,
  category VARCHAR(50) NOT NULL, -- 'dairy' | 'flowers' | 'claypots' | etc.
  zone_id UUID NOT NULL REFERENCES delivery_zones(id),
  phone VARCHAR(15),
  is_active BOOLEAN NOT NULL DEFAULT true,
  rating NUMERIC(2,1) DEFAULT 0.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Items a vendor sells
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  category VARCHAR(50) NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL,
  unit VARCHAR(20), -- 'liter', 'piece', 'bunch', 'kg', etc.
  image_url VARCHAR(500),
  subscribable BOOLEAN NOT NULL DEFAULT false, -- can this be set up as a recurring subscription?
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Recurring orders (e.g. daily milk)
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  address_id UUID NOT NULL REFERENCES addresses(id),
  frequency VARCHAR(20) NOT NULL DEFAULT 'daily', -- 'daily' | 'alternate_day' | 'weekly'
  quantity INT NOT NULL DEFAULT 1,
  status VARCHAR(20) NOT NULL DEFAULT 'active', -- 'active' | 'paused' | 'cancelled'
  paused_until DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One-time or subscription-generated orders
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  address_id UUID NOT NULL REFERENCES addresses(id),
  zone_id UUID NOT NULL REFERENCES delivery_zones(id),
  subscription_id UUID REFERENCES subscriptions(id), -- null if it's a one-time order
  status VARCHAR(20) NOT NULL DEFAULT 'placed', -- placed | confirmed | out_for_delivery | delivered | cancelled
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  delivery_date DATE NOT NULL,
  delivery_slot VARCHAR(50), -- e.g. 'morning', 'evening'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Line items within an order
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  quantity INT NOT NULL DEFAULT 1,
  price NUMERIC(10,2) NOT NULL, -- price at time of order (snapshot, in case product price changes later)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Helpful indexes for common lookups
CREATE INDEX idx_products_vendor ON products(vendor_id);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_delivery_date ON orders(delivery_date);
CREATE INDEX idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX idx_vendors_zone ON vendors(zone_id);
CREATE INDEX idx_addresses_user ON addresses(user_id);
