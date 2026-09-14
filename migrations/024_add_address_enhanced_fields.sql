-- Add enhanced address fields for better address management
ALTER TABLE addresses ADD COLUMN IF NOT EXISTS ordering_for VARCHAR(20) DEFAULT 'Myself';
ALTER TABLE addresses ADD COLUMN IF NOT EXISTS recipient_name VARCHAR(100);
ALTER TABLE addresses ADD COLUMN IF NOT EXISTS recipient_phone VARCHAR(15);
ALTER TABLE addresses ADD COLUMN IF NOT EXISTS address_type VARCHAR(20) DEFAULT 'Home';
ALTER TABLE addresses ADD COLUMN IF NOT EXISTS custom_address_type VARCHAR(50);
ALTER TABLE addresses ADD COLUMN IF NOT EXISTS flat_house_number VARCHAR(50);
ALTER TABLE addresses ADD COLUMN IF NOT EXISTS street_building_society VARCHAR(100);
ALTER TABLE addresses ADD COLUMN IF NOT EXISTS landmark VARCHAR(100);