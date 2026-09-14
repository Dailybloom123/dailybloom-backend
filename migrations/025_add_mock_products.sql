-- Add mock products for frontend testing
-- These correspond to the MOCK_PRODUCTS array in the frontend

-- First, ensure we have a vendor for these products
INSERT INTO delivery_zones (id, name, pincode, is_active, created_at)
VALUES ('550e8400-e29b-41d4-a716-446655440000', 'Guwahati Central', '781001', true, now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO vendors (id, name, category, zone_id, phone, is_active, rating, created_at)
VALUES ('550e8400-e29b-41d4-a716-446655440001', 'DailyBloom Dairy', 'dairy', '550e8400-e29b-41d4-a716-446655440000', '9876543210', true, 4.5, now())
ON CONFLICT (id) DO NOTHING;

-- Insert mock products with their prod_* IDs converted to UUIDs
-- Using deterministic UUIDs based on product IDs for consistency

-- Dairy Products
INSERT INTO products (id, vendor_id, name, category, description, price, unit, image_url, subscribable, is_active, created_at, stock, stock_reserved, reorder_level)
VALUES ('550e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440001', 'Cow Milk', 'dairy', 'Fresh cow milk', 65, '1L', 'https://images.unsplash.com/photo-1563636619-e9143da7973b?auto=format&fit=crop&w=300&q=80', true, true, now(), 100, 0, 10)
ON CONFLICT (id) DO NOTHING;

INSERT INTO products (id, vendor_id, name, category, description, price, unit, image_url, subscribable, is_active, created_at, stock, stock_reserved, reorder_level)
VALUES ('550e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440001', 'Buffalo Milk', 'dairy', 'Fresh buffalo milk', 70, '1L', 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=300&q=80', true, true, now(), 100, 0, 10)
ON CONFLICT (id) DO NOTHING;

INSERT INTO products (id, vendor_id, name, category, description, price, unit, image_url, subscribable, is_active, created_at, stock, stock_reserved, reorder_level)
VALUES ('550e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440001', 'Curd made from Cow Milk', 'dairy', 'Fresh curd from cow milk', 45, '500g', 'https://images.unsplash.com/photo-1606312619070-d48b4c652a52?auto=format&fit=crop&w=300&q=80', true, true, now(), 100, 0, 10)
ON CONFLICT (id) DO NOTHING;

INSERT INTO products (id, vendor_id, name, category, description, price, unit, image_url, subscribable, is_active, created_at, stock, stock_reserved, reorder_level)
VALUES ('550e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440001', 'Curd made from Buffalo Milk', 'dairy', 'Fresh curd from buffalo milk', 50, '500g', 'https://images.unsplash.com/photo-1606312619070-d48b4c652a52?auto=format&fit=crop&w=300&q=80', true, true, now(), 100, 0, 10)
ON CONFLICT (id) DO NOTHING;

INSERT INTO products (id, vendor_id, name, category, description, price, unit, image_url, subscribable, is_active, created_at, stock, stock_reserved, reorder_level)
VALUES ('550e8400-e29b-41d4-a716-446655440006', '550e8400-e29b-41d4-a716-446655440001', 'Organic Ghee', 'dairy', 'Pure organic ghee', 450, '500ml', 'https://images.unsplash.com/photo-1596797038530-2c107229654b?auto=format&fit=crop&w=300&q=80', true, true, now(), 50, 0, 5)
ON CONFLICT (id) DO NOTHING;

INSERT INTO products (id, vendor_id, name, category, description, price, unit, image_url, subscribable, is_active, created_at, stock, stock_reserved, reorder_level)
VALUES ('550e8400-e29b-41d4-a716-446655440007', '550e8400-e29b-41d4-a716-446655440001', 'Fresh Cream made from Cow Milk', 'dairy', 'Fresh cream from cow milk', 80, '200ml', 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=300&q=80', true, true, now(), 100, 0, 10)
ON CONFLICT (id) DO NOTHING;

-- Bakery Products
INSERT INTO products (id, vendor_id, name, category, description, price, unit, image_url, subscribable, is_active, created_at, stock, stock_reserved, reorder_level)
VALUES ('550e8400-e29b-41d4-a716-446655440008', '550e8400-e29b-41d4-a716-446655440001', 'Whole Wheat Unsliced Bread', 'bakery', 'Whole wheat unsliced bread', 45, '400g', 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=300&q=80', true, true, now(), 100, 0, 10)
ON CONFLICT (id) DO NOTHING;

INSERT INTO products (id, vendor_id, name, category, description, price, unit, image_url, subscribable, is_active, created_at, stock, stock_reserved, reorder_level)
VALUES ('550e8400-e29b-41d4-a716-446655440009', '550e8400-e29b-41d4-a716-446655440001', 'Whole Wheat Sliced Bread', 'bakery', 'Whole wheat sliced bread', 48, '400g', 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=300&q=80', true, true, now(), 100, 0, 10)
ON CONFLICT (id) DO NOTHING;

INSERT INTO products (id, vendor_id, name, category, description, price, unit, image_url, subscribable, is_active, created_at, stock, stock_reserved, reorder_level)
VALUES ('550e8400-e29b-41d4-a716-446655440010', '550e8400-e29b-41d4-a716-446655440001', 'Sliced Milk Bread', 'bakery', 'Sliced milk bread', 40, '400g', 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=300&q=80', true, true, now(), 100, 0, 10)
ON CONFLICT (id) DO NOTHING;

INSERT INTO products (id, vendor_id, name, category, description, price, unit, image_url, subscribable, is_active, created_at, stock, stock_reserved, reorder_level)
VALUES ('550e8400-e29b-41d4-a716-446655440011', '550e8400-e29b-41d4-a716-446655440001', 'Unsliced Milk Bread', 'bakery', 'Unsliced milk bread', 38, '400g', 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=300&q=80', true, true, now(), 100, 0, 10)
ON CONFLICT (id) DO NOTHING;

INSERT INTO products (id, vendor_id, name, category, description, price, unit, image_url, subscribable, is_active, created_at, stock, stock_reserved, reorder_level)
VALUES ('550e8400-e29b-41d4-a716-446655440012', '550e8400-e29b-41d4-a716-446655440001', 'White Sandwich Bread', 'bakery', 'White sandwich bread', 42, '400g', 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=300&q=80', true, true, now(), 100, 0, 10)
ON CONFLICT (id) DO NOTHING;

INSERT INTO products (id, vendor_id, name, category, description, price, unit, image_url, subscribable, is_active, created_at, stock, stock_reserved, reorder_level)
VALUES ('550e8400-e29b-41d4-a716-446655440013', '550e8400-e29b-41d4-a716-446655440001', 'Brown Sandwich Bread', 'bakery', 'Brown sandwich bread', 48, '400g', 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=300&q=80', true, true, now(), 100, 0, 10)
ON CONFLICT (id) DO NOTHING;

INSERT INTO products (id, vendor_id, name, category, description, price, unit, image_url, subscribable, is_active, created_at, stock, stock_reserved, reorder_level)
VALUES ('550e8400-e29b-41d4-a716-446655440014', '550e8400-e29b-41d4-a716-446655440001', 'Multigrain Bread', 'bakery', 'Multigrain bread', 55, '400g', 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=300&q=80', true, true, now(), 100, 0, 10)
ON CONFLICT (id) DO NOTHING;

INSERT INTO products (id, vendor_id, name, category, description, price, unit, image_url, subscribable, is_active, created_at, stock, stock_reserved, reorder_level)
VALUES ('550e8400-e29b-41d4-a716-446655440015', '550e8400-e29b-41d4-a716-446655440001', 'Kulcha Bread', 'bakery', 'Kulcha bread', 35, '4 pcs', 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=300&q=80', true, true, now(), 100, 0, 10)
ON CONFLICT (id) DO NOTHING;

INSERT INTO products (id, vendor_id, name, category, description, price, unit, image_url, subscribable, is_active, created_at, stock, stock_reserved, reorder_level)
VALUES ('550e8400-e29b-41d4-a716-446655440016', '550e8400-e29b-41d4-a716-446655440001', 'Bun Bread', 'bakery', 'Bun bread', 30, '4 pcs', 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=300&q=80', true, true, now(), 100, 0, 10)
ON CONFLICT (id) DO NOTHING;

INSERT INTO products (id, vendor_id, name, category, description, price, unit, image_url, subscribable, is_active, created_at, stock, stock_reserved, reorder_level)
VALUES ('550e8400-e29b-41d4-a716-446655440017', '550e8400-e29b-41d4-a716-446655440001', 'Pav Bread', 'bakery', 'Pav bread', 32, '8 pcs', 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=300&q=80', true, true, now(), 100, 0, 10)
ON CONFLICT (id) DO NOTHING;

INSERT INTO products (id, vendor_id, name, category, description, price, unit, image_url, subscribable, is_active, created_at, stock, stock_reserved, reorder_level)
VALUES ('550e8400-e29b-41d4-a716-446655440018', '550e8400-e29b-41d4-a716-446655440001', 'Croissant', 'bakery', 'Fresh croissant', 60, '1 pc', 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=300&q=80', false, true, now(), 50, 0, 5)
ON CONFLICT (id) DO NOTHING;

-- Organic Essentials
INSERT INTO products (id, vendor_id, name, category, description, price, unit, image_url, subscribable, is_active, created_at, stock, stock_reserved, reorder_level)
VALUES ('550e8400-e29b-41d4-a716-446655440019', '550e8400-e29b-41d4-a716-446655440001', 'Organic Honey', 'honey', 'Pure organic honey', 350, '500g', 'https://images.unsplash.com/photo-1587049352846-4a222e784d30?auto=format&fit=crop&w=300&q=80', false, true, now(), 30, 0, 5)
ON CONFLICT (id) DO NOTHING;

INSERT INTO products (id, vendor_id, name, category, description, price, unit, image_url, subscribable, is_active, created_at, stock, stock_reserved, reorder_level)
VALUES ('550e8400-e29b-41d4-a716-446655440020', '550e8400-e29b-41d4-a716-446655440001', 'Organic Jaggery', 'honey', 'Organic jaggery', 180, '500g', 'https://images.unsplash.com/photo-1587049352846-4a222e784d30?auto=format&fit=crop&w=300&q=80', false, true, now(), 30, 0, 5)
ON CONFLICT (id) DO NOTHING;

-- Fresh Flowers
INSERT INTO products (id, vendor_id, name, category, description, price, unit, image_url, subscribable, is_active, created_at, stock, stock_reserved, reorder_level)
VALUES ('550e8400-e29b-41d4-a716-446655440021', '550e8400-e29b-41d4-a716-446655440001', 'Marigold', 'flowers', 'Fresh marigold flowers', 50, '1 Bunch', 'https://images.unsplash.com/photo-1574167227613-81927d583814?auto=format&fit=crop&w=300&q=80', true, true, now(), 100, 0, 10)
ON CONFLICT (id) DO NOTHING;

INSERT INTO products (id, vendor_id, name, category, description, price, unit, image_url, subscribable, is_active, created_at, stock, stock_reserved, reorder_level)
VALUES ('550e8400-e29b-41d4-a716-446655440022', '550e8400-e29b-41d4-a716-446655440001', 'Lotus', 'flowers', 'Fresh lotus flowers', 80, '1 Bunch', 'https://images.unsplash.com/photo-1518568814500-bf0f8d125f46?auto=format&fit=crop&w=300&q=80', true, true, now(), 50, 0, 5)
ON CONFLICT (id) DO NOTHING;

INSERT INTO products (id, vendor_id, name, category, description, price, unit, image_url, subscribable, is_active, created_at, stock, stock_reserved, reorder_level)
VALUES ('550e8400-e29b-41d4-a716-446655440023', '550e8400-e29b-41d4-a716-446655440001', 'Kathanda', 'flowers', 'Fresh kathanda flowers', 45, '1 Bunch', 'https://images.unsplash.com/photo-1597848212624-a19eb35e2651?auto=format&fit=crop&w=300&q=80', true, true, now(), 100, 0, 10)
ON CONFLICT (id) DO NOTHING;