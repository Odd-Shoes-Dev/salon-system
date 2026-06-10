-- ============================================================
-- Migration 008: Multi-Branch Support
-- ============================================================

-- 1. Branches table
CREATE TABLE branches (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id    uuid        NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  name        varchar     NOT NULL,
  address     text,
  phone       varchar,
  email       varchar,
  is_active   boolean     NOT NULL DEFAULT true,
  deleted_at  timestamptz,
  deleted_by  uuid,       -- populated on soft-delete (ref filled after staff table altered)
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(salon_id, name)
);

-- 2. Seed a default "Main Branch" for every existing salon so we can
--    back-fill branch_id on all other tables without NULLs.
INSERT INTO branches (salon_id, name, created_at, updated_at)
SELECT id, 'Main Branch', now(), now()
FROM   salons
ON CONFLICT DO NOTHING;

-- 3. Add branch_id to staff (owner keeps NULL = all-access)
ALTER TABLE staff
  ADD COLUMN branch_id uuid REFERENCES branches(id) ON DELETE SET NULL;

-- Back-fill every non-owner staff member to the Main Branch of their salon
UPDATE staff s
SET    branch_id = (
  SELECT b.id FROM branches b
  WHERE  b.salon_id = s.salon_id AND b.name = 'Main Branch'
  LIMIT 1
)
WHERE  s.role <> 'owner';

-- 4. Add branch_id to sessions so we can resolve branch without an
--    extra join on every request
ALTER TABLE sessions
  ADD COLUMN branch_id uuid REFERENCES branches(id) ON DELETE SET NULL;

-- 5. Add branch_id to workers
ALTER TABLE workers
  ADD COLUMN branch_id uuid REFERENCES branches(id) ON DELETE SET NULL;

UPDATE workers w
SET    branch_id = (
  SELECT b.id FROM branches b
  WHERE  b.salon_id = w.salon_id AND b.name = 'Main Branch'
  LIMIT 1
);

-- 6. Add branch_id to bookings
ALTER TABLE bookings
  ADD COLUMN branch_id uuid REFERENCES branches(id) ON DELETE SET NULL;

UPDATE bookings bk
SET    branch_id = (
  SELECT b.id FROM branches b
  WHERE  b.salon_id = bk.salon_id AND b.name = 'Main Branch'
  LIMIT 1
);

-- 7. Add branch_id to visits
ALTER TABLE visits
  ADD COLUMN branch_id uuid REFERENCES branches(id) ON DELETE SET NULL;

UPDATE visits v
SET    branch_id = (
  SELECT b.id FROM branches b
  WHERE  b.salon_id = v.salon_id AND b.name = 'Main Branch'
  LIMIT 1
);

-- 8. Add branch_id to expenses
ALTER TABLE expenses
  ADD COLUMN branch_id uuid REFERENCES branches(id) ON DELETE SET NULL;

UPDATE expenses e
SET    branch_id = (
  SELECT b.id FROM branches b
  WHERE  b.salon_id = e.salon_id AND b.name = 'Main Branch'
  LIMIT 1
);

-- 9. Audit log table for all branch-scoped actions
CREATE TABLE branch_audit_logs (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id     uuid        NOT NULL REFERENCES salons(id),
  branch_id    uuid        REFERENCES branches(id),
  staff_id     uuid        REFERENCES staff(id),
  action       varchar     NOT NULL,   -- e.g. 'created_booking', 'deleted_visit'
  table_name   varchar,
  record_id    uuid,
  old_values   jsonb,
  new_values   jsonb,
  ip_address   varchar,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- 10. Now add the FK from branches.deleted_by → staff(id)
ALTER TABLE branches
  ADD CONSTRAINT branches_deleted_by_fkey
  FOREIGN KEY (deleted_by) REFERENCES staff(id) ON DELETE SET NULL;

-- 11. Indexes
CREATE INDEX idx_branches_salon        ON branches(salon_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_staff_branch          ON staff(branch_id);
CREATE INDEX idx_workers_branch        ON workers(branch_id);
CREATE INDEX idx_bookings_branch_date  ON bookings(branch_id, booking_date);
CREATE INDEX idx_visits_branch         ON visits(branch_id) WHERE is_active = true;
CREATE INDEX idx_expenses_branch       ON expenses(branch_id);
CREATE INDEX idx_audit_logs_branch     ON branch_audit_logs(salon_id, branch_id, created_at DESC);
CREATE INDEX idx_sessions_branch       ON sessions(branch_id);
