-- Add Posh Nailcare logo to the localhost salon
UPDATE salons 
SET logo_url = '/assets/images/posh-logo.png'
WHERE subdomain = 'localhost';
