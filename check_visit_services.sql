-- Check if visit_services table has any records
SELECT 
  v.receipt_number,
  v.created_at,
  COUNT(vs.id) as service_count
FROM visits v
LEFT JOIN visit_services vs ON v.id = vs.visit_id
WHERE v.salon_id IN (SELECT id FROM salons WHERE subdomain = 'posh')
GROUP BY v.id, v.receipt_number, v.created_at
ORDER BY v.created_at DESC;

-- Show visits without services
SELECT 
  v.receipt_number,
  v.created_at,
  v.total_amount,
  c.name as client_name
FROM visits v
JOIN clients c ON v.client_id = c.id
LEFT JOIN visit_services vs ON v.id = vs.visit_id
WHERE v.salon_id IN (SELECT id FROM salons WHERE subdomain = 'posh')
  AND vs.id IS NULL
ORDER BY v.created_at DESC;
