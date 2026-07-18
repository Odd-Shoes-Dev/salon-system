-- ── 026: Suppliers, group hierarchy, stock allocations ─────────────────────
-- Adds:
--   • suppliers          — proper supplier/manufacturer records
--   • stock_groups.parent_id — self-referential hierarchy (parent → child groups)
--   • stock_items.supplier_id — FK to suppliers (replaces free-text supplier column)
--   • stock_items.sku    — optional product code / barcode field for future scanning
--   • stock_movements.worker_id, allocation_id, reference_type, reference_id
--   • stock_allocations  — staff loan lifecycle table

-- ── 1. Suppliers ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS suppliers (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id       UUID        NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  name           TEXT        NOT NULL,
  contact_person TEXT,
  phone          TEXT,
  email          TEXT,
  address        TEXT,
  notes          TEXT,
  is_active      BOOLEAN     NOT NULL DEFAULT true,
  deleted_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(salon_id, name)
);

CREATE INDEX IF NOT EXISTS idx_suppliers_salon ON suppliers(salon_id) WHERE deleted_at IS NULL;

-- ── 2. Group hierarchy ────────────────────────────────────────────────────────
ALTER TABLE stock_groups
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES stock_groups(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_stock_groups_parent
  ON stock_groups(parent_id) WHERE parent_id IS NOT NULL;

-- ── 3. stock_items: supplier FK + SKU ────────────────────────────────────────
ALTER TABLE stock_items
  ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL;

ALTER TABLE stock_items
  ADD COLUMN IF NOT EXISTS sku TEXT;

CREATE INDEX IF NOT EXISTS idx_stock_items_supplier
  ON stock_items(supplier_id) WHERE supplier_id IS NOT NULL;

-- ── 4. Migrate existing free-text supplier values ─────────────────────────────
-- Create supplier records from unique supplier names already in stock_items,
-- then back-fill supplier_id so no existing data is lost.
INSERT INTO suppliers (salon_id, name)
SELECT DISTINCT salon_id, trim(supplier)
FROM stock_items
WHERE supplier IS NOT NULL AND trim(supplier) <> ''
ON CONFLICT (salon_id, name) DO NOTHING;

UPDATE stock_items si
SET    supplier_id = sup.id
FROM   suppliers sup
WHERE  sup.salon_id = si.salon_id
  AND  sup.name     = trim(si.supplier)
  AND  si.supplier  IS NOT NULL
  AND  trim(si.supplier) <> '';

-- ── 5. Extend stock_movements ────────────────────────────────────────────────
ALTER TABLE stock_movements
  ADD COLUMN IF NOT EXISTS worker_id      UUID REFERENCES workers(id) ON DELETE SET NULL;

-- allocation_id added as plain uuid first; FK added after the allocations table exists
ALTER TABLE stock_movements
  ADD COLUMN IF NOT EXISTS allocation_id UUID;

-- Generic forward-link for future integrations (visits, purchase orders, etc.)
ALTER TABLE stock_movements
  ADD COLUMN IF NOT EXISTS reference_type TEXT;  -- 'visit' | 'allocation' | 'purchase_order'

ALTER TABLE stock_movements
  ADD COLUMN IF NOT EXISTS reference_id UUID;

CREATE INDEX IF NOT EXISTS idx_stock_movements_worker
  ON stock_movements(worker_id) WHERE worker_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_stock_movements_allocation
  ON stock_movements(allocation_id) WHERE allocation_id IS NOT NULL;

-- ── 6. Stock allocations ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_allocations (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id       UUID          NOT NULL REFERENCES salons(id)      ON DELETE CASCADE,
  branch_id      UUID          REFERENCES branches(id)             ON DELETE SET NULL,
  worker_id      UUID          NOT NULL REFERENCES workers(id)     ON DELETE CASCADE,
  item_id        UUID          NOT NULL REFERENCES stock_items(id) ON DELETE CASCADE,
  qty_allocated  NUMERIC(12,2) NOT NULL,
  qty_returned   NUMERIC(12,2) NOT NULL DEFAULT 0,
  status         TEXT          NOT NULL DEFAULT 'active',  -- active | partial_return | closed
  notes          TEXT,
  allocated_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
  returned_at    TIMESTAMPTZ,
  allocated_by   UUID          REFERENCES staff(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_allocations_salon
  ON stock_allocations(salon_id, allocated_at DESC);

CREATE INDEX IF NOT EXISTS idx_stock_allocations_worker
  ON stock_allocations(worker_id, status);

CREATE INDEX IF NOT EXISTS idx_stock_allocations_item
  ON stock_allocations(item_id);

-- ── 7. Now add the FK for allocation_id on stock_movements ───────────────────
ALTER TABLE stock_movements
  ADD CONSTRAINT fk_stock_movements_allocation
  FOREIGN KEY (allocation_id) REFERENCES stock_allocations(id) ON DELETE SET NULL;
