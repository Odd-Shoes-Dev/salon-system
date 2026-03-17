-- Add services for Posh Nailcare (automatically gets salon_id)
INSERT INTO services (salon_id, name, price, duration_minutes, category, is_active)
SELECT id, 'Manicure', 25000, 45, 'Nails', true FROM salons WHERE subdomain = 'posh'
UNION ALL
SELECT id, 'Pedicure', 30000, 60, 'Nails', true FROM salons WHERE subdomain = 'posh'
UNION ALL
SELECT id, 'Gel Nails', 40000, 90, 'Nails', true FROM salons WHERE subdomain = 'posh'
UNION ALL
SELECT id, 'Acrylic Nails', 50000, 120, 'Nails', true FROM salons WHERE subdomain = 'posh'
UNION ALL
SELECT id, 'Nail Art', 15000, 30, 'Nails', true FROM salons WHERE subdomain = 'posh'
UNION ALL
SELECT id, 'Polish Change', 10000, 20, 'Nails', true FROM salons WHERE subdomain = 'posh';

-- Verify services were added
SELECT name, price, category FROM services WHERE salon_id = (SELECT id FROM salons WHERE subdomain = 'posh');
