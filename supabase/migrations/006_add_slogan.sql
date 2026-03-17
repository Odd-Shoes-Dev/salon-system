-- Add slogan field to salons table
ALTER TABLE salons 
  ADD COLUMN IF NOT EXISTS slogan VARCHAR(255);

-- Update Posh Nailcare's slogan
UPDATE salons 
SET slogan = 'Come and Experience the Difference'
WHERE subdomain = 'localhost';

-- Add comment
COMMENT ON COLUMN salons.slogan IS 'Salon tagline or slogan displayed on login and marketing materials';
