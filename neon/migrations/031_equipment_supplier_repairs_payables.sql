-- ── 031: Equipment supplier link, repair log, payable improvements ───────────

-- ── 1. Link equipment to supplier ────────────────────────────────────────────
ALTER TABLE equipment
  ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_equipment_supplier
  ON equipment(supplier_id) WHERE supplier_id IS NOT NULL;

-- ── 2. Repair log per equipment item ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS equipment_repairs (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id     UUID          NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  equipment_id UUID          NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
  description  TEXT          NOT NULL,
  repair_date  DATE,
  cost         NUMERIC(12,2),
  repaired_by  TEXT,
  status       TEXT          NOT NULL DEFAULT 'pending',
  notes        TEXT,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT equipment_repairs_status_check CHECK (
    status IN ('pending', 'in_progress', 'done')
  )
);

CREATE INDEX IF NOT EXISTS idx_equipment_repairs_equipment
  ON equipment_repairs(equipment_id, created_at DESC);

-- ── 3. Supplier payables: partial payments + equipment link ───────────────────
ALTER TABLE supplier_payables
  ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0;

ALTER TABLE supplier_payables
  ADD COLUMN IF NOT EXISTS equipment_id UUID REFERENCES equipment(id) ON DELETE SET NULL;

-- Widen status check to allow 'partial'
ALTER TABLE supplier_payables
  DROP CONSTRAINT IF EXISTS supplier_payables_status_check;

ALTER TABLE supplier_payables
  ADD CONSTRAINT supplier_payables_status_check
  CHECK (status IN ('outstanding', 'partial', 'paid'));

CREATE INDEX IF NOT EXISTS idx_supplier_payables_equipment
  ON supplier_payables(equipment_id) WHERE equipment_id IS NOT NULL;
