-- Update all clients' total_visits based on actual visits
UPDATE clients
SET total_visits = (
  SELECT COUNT(*)
  FROM visits
  WHERE client_id = clients.id
);

-- Verify the update
SELECT name, phone, loyalty_points, total_spent, total_visits
FROM clients
ORDER BY name;
