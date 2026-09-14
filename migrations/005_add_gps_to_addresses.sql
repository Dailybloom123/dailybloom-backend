-- Add latitude and longitude fields to addresses table for GPS location
ALTER TABLE addresses ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8);
ALTER TABLE addresses ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);
