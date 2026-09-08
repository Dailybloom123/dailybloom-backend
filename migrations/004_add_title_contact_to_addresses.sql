-- Add title and contact_number fields to addresses table
ALTER TABLE addresses ADD COLUMN IF NOT EXISTS title VARCHAR(10);
ALTER TABLE addresses ADD COLUMN IF NOT EXISTS contact_number VARCHAR(15);
