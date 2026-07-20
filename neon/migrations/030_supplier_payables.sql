-- ── 030: Supplier payables ───────────────────────────────────────────────────
-- Tracks amounts owed to suppliers when stock arrives on credit

CREATE TABLE IF NOT EXISTS supplier_payables (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id       UUID          NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  branch_id      UUID          REFERENCES branches(id) ON DELETE SET NULL,
  supplier_id    UUID          REFERENCES suppliers(id) ON DELETE SET NULL,
  description    TEXT          NOT NULL,
  amount         NUMERIC(12,2) NOT NULL,
  due_date       DATE,
  status         TEXT          NOT NULL DEFAULT 'outstanding',
  paid_at        TIMESTAMPTZ,
  notes          TEXT,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT supplier_payables_status_check CHECK (
    status IN ('outstanding', 'paid')
  )
);

CREATE INDEX IF NOT EXISTS idx_supplier_payables_salon
  ON supplier_payables(salon_id, status, due_date);

CREATE INDEX IF NOT EXISTS idx_supplier_payables_supplier
  ON supplier_payables(supplier_id) WHERE supplier_id IS NOT NULL;
