-- =============================================================
-- Backfill NULL branch_id to the default branch per salon
-- Run once in the Neon SQL Editor
-- Safe to re-run: WHERE branch_id IS NULL means already-set
-- rows are never touched.
-- =============================================================

-- 1. visits
UPDATE visits
SET    branch_id = b.id
FROM   branches b
WHERE  b.salon_id   = visits.salon_id
  AND  b.is_default = true
  AND  b.deleted_at IS NULL
  AND  visits.branch_id IS NULL;

-- 2. expenses
UPDATE expenses
SET    branch_id = b.id
FROM   branches b
WHERE  b.salon_id   = expenses.salon_id
  AND  b.is_default = true
  AND  b.deleted_at IS NULL
  AND  expenses.branch_id IS NULL;

-- 3. workers (stylists)
UPDATE workers
SET    branch_id = b.id
FROM   branches b
WHERE  b.salon_id   = workers.salon_id
  AND  b.is_default = true
  AND  b.deleted_at IS NULL
  AND  workers.branch_id IS NULL;

-- 4. staff (admin/manager/receptionist accounts)
UPDATE staff
SET    branch_id = b.id
FROM   branches b
WHERE  b.salon_id   = staff.salon_id
  AND  b.is_default = true
  AND  b.deleted_at IS NULL
  AND  staff.branch_id IS NULL
  AND  staff.role <> 'owner';   -- owners intentionally have NULL branch_id

-- 5. bookings
UPDATE bookings
SET    branch_id = b.id
FROM   branches b
WHERE  b.salon_id   = bookings.salon_id
  AND  b.is_default = true
  AND  b.deleted_at IS NULL
  AND  bookings.branch_id IS NULL;

-- 6. stock_movements
UPDATE stock_movements
SET    branch_id = b.id
FROM   branches b
WHERE  b.salon_id   = stock_movements.salon_id
  AND  b.is_default = true
  AND  b.deleted_at IS NULL
  AND  stock_movements.branch_id IS NULL;

-- 7. clients  (last_visit_branch_id — only if a last visit exists)
UPDATE clients
SET    last_visit_branch_id = b.id
FROM   branches b
WHERE  b.salon_id              = clients.salon_id
  AND  b.is_default            = true
  AND  b.deleted_at            IS NULL
  AND  clients.last_visit_branch_id IS NULL
  AND  clients.last_visit      IS NOT NULL;  -- only clients who have visited

-- =============================================================
-- Verify: these should all return 0 rows after running
-- =============================================================
-- SELECT 'visits'          , COUNT(*) FROM visits          WHERE branch_id IS NULL;
-- SELECT 'expenses'        , COUNT(*) FROM expenses        WHERE branch_id IS NULL AND deleted_at IS NULL;
-- SELECT 'workers'         , COUNT(*) FROM workers         WHERE branch_id IS NULL;
-- SELECT 'staff'           , COUNT(*) FROM staff           WHERE branch_id IS NULL AND role <> 'owner';
-- SELECT 'bookings'        , COUNT(*) FROM bookings        WHERE branch_id IS NULL;
-- SELECT 'stock_movements' , COUNT(*) FROM stock_movements WHERE branch_id IS NULL;
