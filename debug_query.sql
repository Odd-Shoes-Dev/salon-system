-- Run this in Supabase SQL Editor to verify your data

-- Check salons
SELECT id, name, subdomain, is_active FROM salons;

-- Check staff accounts
SELECT s.id, s.name, s.phone, s.role, s.is_active, 
       sa.name as salon_name, sa.subdomain
FROM staff s
JOIN salons sa ON s.salon_id = sa.id
ORDER BY s.phone;

-- Check if PIN hash exists
SELECT phone, 
       CASE WHEN pin_hash IS NOT NULL THEN 'Yes' ELSE 'No' END as has_pin,
       CASE WHEN password_hash IS NOT NULL THEN 'Yes' ELSE 'No' END as has_password
FROM staff;
