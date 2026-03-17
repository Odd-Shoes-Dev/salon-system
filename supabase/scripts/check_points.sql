-- Check if loyalty points are being saved
SELECT name, phone, loyalty_points, total_spent, total_visits 
FROM clients 
WHERE phone = '+256726315663';

-- Check recent visits
SELECT v.created_at, v.total_amount, v.points_earned, c.name as client_name
FROM visits v
JOIN clients c ON v.client_id = c.id
WHERE c.phone = '+256726315663'
ORDER BY v.created_at DESC
LIMIT 5;
