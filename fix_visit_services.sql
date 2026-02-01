-- Add missing unit_price column to visit_services table
ALTER TABLE visit_services 
  ADD COLUMN IF NOT EXISTS unit_price DECIMAL(10, 2);

-- Copy existing price values to unit_price
UPDATE visit_services 
SET unit_price = price 
WHERE unit_price IS NULL;

-- Make unit_price required going forward
ALTER TABLE visit_services 
  ALTER COLUMN unit_price SET NOT NULL;
