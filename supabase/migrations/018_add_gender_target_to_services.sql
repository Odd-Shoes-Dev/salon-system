-- Add gender_target column to services table
-- Values: 'male', 'female', 'unisex' (default)

ALTER TABLE services ADD COLUMN IF NOT EXISTS gender_target varchar DEFAULT 'unisex';

-- Update any existing rows to unisex
UPDATE services SET gender_target = 'unisex' WHERE gender_target IS NULL;

-- Index for filtering in POS
CREATE INDEX IF NOT EXISTS idx_services_gender ON services(salon_id, gender_target);
