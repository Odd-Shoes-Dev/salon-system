-- Migration 027: add closed_reason to stock_allocations
-- Tracks WHY an allocation was closed: returned / consumed / damage
-- NULL means still active or partially returned (not yet closed)

ALTER TABLE stock_allocations
  ADD COLUMN IF NOT EXISTS closed_reason TEXT
    CHECK (closed_reason IN ('returned', 'consumed', 'damage'));

-- Back-fill existing closed allocations as 'returned'
-- (all closures before this migration were returns)
UPDATE stock_allocations
  SET closed_reason = 'returned'
  WHERE status = 'closed' AND closed_reason IS NULL;
