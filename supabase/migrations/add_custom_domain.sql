-- Add custom domain for Posh Nailcare
UPDATE salons
SET custom_domain = 'poshnailcare.com'
WHERE subdomain = 'posh';

-- Verify the update
SELECT id, name, subdomain, custom_domain, is_active
FROM salons
WHERE subdomain = 'posh';
