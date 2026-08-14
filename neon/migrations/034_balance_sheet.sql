-- ── 034: Balance sheet additions ──────────────────────────────────────────────
-- 1. Depreciation fields on equipment (useful_life in years, salvage_value)
-- 2. Other-liabilities table for manual entries (bank loans, rent arrears, etc.)

ALTER TABLE equipment
  ADD COLUMN IF NOT EXISTS useful_life   INTEGER        DEFAULT 5,
  ADD COLUMN IF NOT EXISTS salvage_value NUMERIC(12,2)  DEFAULT 0;

CREATE TABLE IF NOT EXISTS other_liabilities (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id      UUID          NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  description   TEXT          NOT NULL,
  category      TEXT          NOT NULL DEFAULT 'other',
  total_amount  NUMERIC(12,2) NOT NULL,
  amount_repaid NUMERIC(12,2) NOT NULL DEFAULT 0,
  due_date      DATE,
  notes         TEXT,
  created_by    UUID          REFERENCES staff(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ,
  CONSTRAINT other_liabilities_category_check CHECK (
    category IN ('bank_loan', 'personal_loan', 'rent_arrear', 'equipment_financing', 'other')
  )
);

CREATE INDEX IF NOT EXISTS idx_other_liabilities_salon
  ON other_liabilities(salon_id) WHERE deleted_at IS NULL;
