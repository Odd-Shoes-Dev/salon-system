-- Fix unique constraints to be scoped per salon (multi-tenant correctness)
--
-- Previously, clients.phone, staff.phone, and staff.email had GLOBAL unique
-- constraints, meaning a phone/email used in one salon would be blocked from
-- being registered in any other salon. For a multi-tenant platform each
-- constraint must be (salon_id, field) scoped.

-- ── clients ────────────────────────────────────────────────────────────────

-- Drop the old global unique constraint (created by "phone VARCHAR UNIQUE")
ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_phone_key;

-- Add per-salon unique constraint
ALTER TABLE clients
  ADD CONSTRAINT clients_salon_phone_key UNIQUE (salon_id, phone);

-- ── staff ──────────────────────────────────────────────────────────────────

-- Drop the old global unique indexes (created in migration 003)
DROP INDEX IF EXISTS idx_staff_phone;
DROP INDEX IF EXISTS idx_staff_email;

-- Add per-salon unique indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_salon_phone
  ON staff(salon_id, phone);

CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_salon_email
  ON staff(salon_id, email)
  WHERE email IS NOT NULL;
