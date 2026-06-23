-- Fix: total_amount should store the subtotal (sum of services + addons) BEFORE
-- checkout_discount. A previous migration incorrectly subtracted checkout_discount
-- from total_amount, and some new sales also stored it wrong.
--
-- This migration recalculates total_amount from the actual line items (source of truth),
-- then recalculates clients.total_spent from the corrected visit totals.
--
-- Revenue queries now use: SUM(total_amount - COALESCE(checkout_discount, 0))

BEGIN;

-- Step 1: Recalculate total_amount from visit_services + visit_addons
UPDATE visits v
SET total_amount = sub.calculated_total
FROM (
  SELECT
    vs_totals.visit_id,
    COALESCE(vs_totals.svc_total, 0) + COALESCE(va_totals.addon_total, 0) AS calculated_total
  FROM (
    SELECT visit_id, SUM(unit_price * quantity) AS svc_total
    FROM visit_services
    GROUP BY visit_id
  ) vs_totals
  LEFT JOIN (
    SELECT visit_id, SUM(price_at_time * quantity) AS addon_total
    FROM visit_addons
    GROUP BY visit_id
  ) va_totals ON va_totals.visit_id = vs_totals.visit_id
) sub
WHERE v.id = sub.visit_id;

-- Step 2: Recalculate clients.total_spent from corrected visit totals (post-discount)
UPDATE clients c
SET total_spent = COALESCE(sub.actual_spent, 0)
FROM (
  SELECT client_id, SUM(total_amount - COALESCE(checkout_discount, 0)) AS actual_spent
  FROM visits
  WHERE is_active = true AND deleted_at IS NULL
  GROUP BY client_id
) sub
WHERE c.id = sub.client_id;

COMMIT;
