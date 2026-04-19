-- ============================================================
-- 023: Expenses & Inventory tables
-- ============================================================

-- ── EXPENSES ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expenses (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id        uuid        NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  category        varchar     NOT NULL DEFAULT 'General',
  amount          numeric(12,2) NOT NULL CHECK (amount >= 0),
  description     text,
  expense_date    date        NOT NULL DEFAULT CURRENT_DATE,
  created_by      uuid        REFERENCES staff(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);

CREATE INDEX IF NOT EXISTS idx_expenses_salon_date ON expenses(salon_id, expense_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_expenses_salon_cat  ON expenses(salon_id, category)    WHERE deleted_at IS NULL;

-- ── STOCK GROUPS (categories for inventory) ──────────────────
CREATE TABLE IF NOT EXISTS stock_groups (
  id          uuid      PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id    uuid      NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  name        varchar   NOT NULL,
  description text,
  color       varchar   NOT NULL DEFAULT '#6366f1',
  sort_order  integer   NOT NULL DEFAULT 0,
  is_active   boolean   NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(salon_id, name)
);

CREATE INDEX IF NOT EXISTS idx_stock_groups_salon ON stock_groups(salon_id) WHERE is_active = true;

-- ── STOCK ITEMS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_items (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id        uuid        NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  group_id        uuid        REFERENCES stock_groups(id) ON DELETE SET NULL,
  name            varchar     NOT NULL,
  description     text,
  unit            varchar     NOT NULL DEFAULT 'pcs',   -- pcs, ml, kg, box, litre, etc.
  current_qty     numeric(12,2) NOT NULL DEFAULT 0,
  reorder_level   numeric(12,2) NOT NULL DEFAULT 0,     -- alert when qty drops to this
  cost_per_unit   numeric(12,2) NOT NULL DEFAULT 0,
  supplier        varchar,
  is_active       boolean     NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz,
  UNIQUE(salon_id, name)
);

CREATE INDEX IF NOT EXISTS idx_stock_items_salon       ON stock_items(salon_id)           WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_stock_items_salon_group ON stock_items(salon_id, group_id) WHERE deleted_at IS NULL;

-- ── STOCK MOVEMENTS (audit log) ───────────────────────────────
CREATE TABLE IF NOT EXISTS stock_movements (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id    uuid        NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  item_id     uuid        NOT NULL REFERENCES stock_items(id) ON DELETE CASCADE,
  qty_change  numeric(12,2) NOT NULL,                  -- positive = add, negative = remove
  qty_after   numeric(12,2) NOT NULL,                  -- snapshot of qty after this movement
  reason      varchar     NOT NULL DEFAULT 'adjustment', -- purchase | use | damage | adjustment | return
  notes       text,
  created_by  uuid        REFERENCES staff(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_item   ON stock_movements(item_id,  created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_salon  ON stock_movements(salon_id, created_at DESC);
