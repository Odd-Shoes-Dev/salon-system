-- ── 029: Equipment tracker ───────────────────────────────────────────────────
-- Adds equipment table to track salon assets (chairs, dryers, clippers, etc.)

CREATE TABLE IF NOT EXISTS equipment (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id       UUID          NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  branch_id      UUID          REFERENCES branches(id) ON DELETE SET NULL,
  name           TEXT          NOT NULL,
  category       TEXT,
  serial_number  TEXT,
  purchase_date  DATE,
  purchase_cost  NUMERIC(12,2),
  condition      TEXT          NOT NULL DEFAULT 'good',
  notes          TEXT,
  is_active      BOOLEAN       NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  deleted_at     TIMESTAMPTZ,
  CONSTRAINT equipment_condition_check CHECK (
    condition IN ('good', 'fair', 'poor', 'needs_repair', 'retired')
  )
);

CREATE INDEX IF NOT EXISTS idx_equipment_salon
  ON equipment(salon_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_equipment_condition
  ON equipment(salon_id, condition) WHERE deleted_at IS NULL;
