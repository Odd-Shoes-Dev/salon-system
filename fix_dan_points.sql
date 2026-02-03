-- Check Dan's current points in the clients table
SELECT id, name, phone, loyalty_points, total_spent, total_visits
FROM clients 
WHERE name = 'Dan';

-- Calculate total points Dan should have from all visits
SELECT SUM(points_earned) as total_points_earned
FROM visits
WHERE client_id IN (SELECT id FROM clients WHERE name = 'Dan');

-- Manually update Dan's points based on visits
UPDATE clients
SET loyalty_points = (
  SELECT COALESCE(SUM(points_earned), 0)
  FROM visits
  WHERE client_id = clients.id
),
total_spent = (
  SELECT COALESCE(SUM(total_amount), 0)
  FROM visits
  WHERE client_id = clients.id
),
total_visits = (
  SELECT COUNT(*)
  FROM visits
  WHERE client_id = clients.id
)
WHERE name = 'Dan';

-- Verify the update
SELECT id, name, phone, loyalty_points, total_spent, total_visits
FROM clients 
WHERE name = 'Dan';
