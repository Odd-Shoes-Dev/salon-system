-- ─────────────────────────────────────────────────────────────────
-- SERVICE ADD-ONS SYSTEM
-- ─────────────────────────────────────────────────────────────────

-- Add-on catalogue per salon
CREATE TABLE IF NOT EXISTS service_addons (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id    uuid        NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  name        varchar     NOT NULL,
  price       numeric(12,0) NOT NULL DEFAULT 0 CHECK (price >= 0),
  description text,
  is_active   boolean     DEFAULT true,
  sort_order  integer     DEFAULT 0,
  created_at  timestamp   DEFAULT now(),
  updated_at  timestamp   DEFAULT now()
);

-- Add-ons attached to a specific visit
CREATE TABLE IF NOT EXISTS visit_addons (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id      uuid        NOT NULL REFERENCES visits(id)         ON DELETE CASCADE,
  addon_id      uuid        NOT NULL REFERENCES service_addons(id)  ON DELETE RESTRICT,
  salon_id      uuid        NOT NULL REFERENCES salons(id)          ON DELETE CASCADE,
  quantity      integer     NOT NULL DEFAULT 1 CHECK (quantity > 0),
  price_at_time numeric(12,0) NOT NULL,
  created_at    timestamp   DEFAULT now()
);

-- Index for fast lookup of add-ons per visit
CREATE INDEX IF NOT EXISTS visit_addons_visit_idx ON visit_addons (visit_id);
