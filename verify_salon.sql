-- Check if the subdomain update worked
SELECT id, name, subdomain, theme_primary_color, slogan, logo_url 
FROM salons;

-- This should show 'posh' as the subdomain, not 'localhost'
