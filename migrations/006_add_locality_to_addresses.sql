-- Add locality field to addresses table for better location tracking
ALTER TABLE addresses ADD COLUMN IF NOT EXISTS locality VARCHAR(100);
