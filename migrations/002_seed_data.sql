-- Sample data so you can test the API immediately after setup.
-- Safe to skip if you'd rather start with an empty database.

INSERT INTO delivery_zones (id, name, pincode) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Green Park', '110016');

INSERT INTO vendors (id, name, category, zone_id) VALUES
  ('22222222-2222-2222-2222-222222222221', 'Shivam Dairy Farm', 'dairy', '11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222', 'Petal & Stem Florist', 'flowers', '11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222223', 'Kumhar Claypots', 'claypots', '11111111-1111-1111-1111-111111111111');

INSERT INTO products (vendor_id, name, category, price, unit, subscribable) VALUES
  ('22222222-2222-2222-2222-222222222221', 'Fresh Cow Milk', 'dairy', 60.00, 'liter', true),
  ('22222222-2222-2222-2222-222222222221', 'Homemade Paneer', 'dairy', 120.00, '250g', false),
  ('22222222-2222-2222-2222-222222222222', 'Rose Bouquet (12 stems)', 'flowers', 450.00, 'piece', false),
  ('22222222-2222-2222-2222-222222222222', 'Marigold Garland', 'flowers', 80.00, 'piece', false),
  ('22222222-2222-2222-2222-222222222223', 'Handmade Clay Diya (set of 6)', 'claypots', 150.00, 'set', false),
  ('22222222-2222-2222-2222-222222222223', 'Terracotta Water Pot', 'claypots', 350.00, 'piece', false);
