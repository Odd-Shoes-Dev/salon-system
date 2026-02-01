-- Update theme colors to red and white for Posh Nailcare
UPDATE salons 
SET 
  name = 'Posh Nailcare',
  theme_primary_color = '#E31C23',  -- Red color (like in logo)
  theme_secondary_color = '#FFFFFF'  -- White
WHERE subdomain = 'localhost';
