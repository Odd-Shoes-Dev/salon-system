-- ── 033: Purchases module ─────────────────────────────────────────────────────
-- Tracks stock purchases separately from operating expenses.
-- Provides the data needed to calculate Cost of Goods Sold (COGS):
--   Opening Stock + Purchases + Carriage − Closing Stock = COGS

-- ── 1. Purchases (header) ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS purchases (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id        UUID          NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  branch_id       UUID          REFERENCES branches(id) ON DELETE SET NULL,
  supplier_id     UUID          REFERENCES suppliers(id) ON DELETE SET NULL,
  purchase_date   DATE          NOT NULL DEFAULT CURRENT_DATE,
  payment_type    TEXT          NOT NULL DEFAULT 'cash',
  account_id      UUID          REFERENCES accounts(id) ON DELETE SET NULL,
  carriage_inward NUMERIC(12,2) NOT NULL DEFAULT 0,
  subtotal        NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_cost      NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes           TEXT,
  status          TEXT          NOT NULL DEFAULT 'paid',
  due_date        DATE,
  created_by      UUID          REFERENCES staff(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT purchases_payment_type_check CHECK (
    payment_type IN ('cash', 'mtn_mobile_money', 'airtel_money', 'bank', 'credit')
  ),
    status IN ('paid', 'credit')
  )
);

CREATE INDEX IF NOT EXISTS idx_purchases_salon_date
  ON purchases(salon_id, purchase_date DESC);

CREATE INDEX IF NOT EXISTS idx_purchases_supplier
  ON purchases(supplier_id) WHERE supplier_id IS NOT NULL;

-- ── 2. Purchase line items ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS purchase_items (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id  UUID          NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  salon_id     UUID          NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  item_id      UUID          REFERENCES stock_items(id) ON DELETE SET NULL,
  item_name    TEXT          NOT NULL,
  unit         TEXT          NOT NULL DEFAULT 'pcs',
  qty          NUMERIC(12,2) NOT NULL,
  unit_cost    NUMERIC(12,2) NOT NULL,
  line_total   NUMERIC(12,2) NOT NULL,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase
  ON purchase_items(purchase_id);

CREATE INDEX IF NOT EXISTS idx_purchase_items_item
  ON purchase_items(item_id) WHERE item_id IS NOT NULL;

-- ── 3. Stock counts (closing inventory) ──────────────────────────────────────
-- Periodic physical count of inventory value, used in COGS calculation.
CREATE TABLE IF NOT EXISTS stock_counts (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id     UUID          NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  branch_id    UUID          REFERENCES branches(id) ON DELETE SET NULL,
  count_date   DATE          NOT NULL,
  period_label TEXT,
  total_value  NUMERIC(14,2) NOT NULL,
  notes        TEXT,
  created_by   UUID          REFERENCES staff(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_counts_salon_date
  ON stock_counts(salon_id, count_date DESC);

-- ── 4. Link payables back to the purchase that created them ───────────────────
ALTER TABLE supplier_payables
  ADD COLUMN IF NOT EXISTS purchase_id UUID REFERENCES purchases(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_supplier_payables_purchase
  ON supplier_payables(purchase_id) WHERE purchase_id IS NOT NULL;
