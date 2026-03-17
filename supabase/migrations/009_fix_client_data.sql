-- Fix existing clients with NULL loyalty_points
UPDATE clients 
SET loyalty_points = 0 
WHERE loyalty_points IS NULL;

UPDATE clients 
SET total_visits = 0 
WHERE total_visits IS NULL;

UPDATE clients 
SET total_spent = 0 
WHERE total_spent IS NULL;

-- Verify the update
SELECT id, name, phone, loyalty_points, total_visits, total_spent 
FROM clients;
