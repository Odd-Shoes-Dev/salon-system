-- Migration 013: Multi-worker visits
-- Creates a junction table so a single visit can be attributed to multiple workers.
-- Existing visits with a single worker_id are migrated automatically.

CREATE TABLE IF NOT EXISTS visit_workers (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id   UUID NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
  worker_id  UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  salon_id   UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (visit_id, worker_id)
);

CREATE INDEX IF NOT EXISTS idx_visit_workers_visit  ON visit_workers(visit_id);
CREATE INDEX IF NOT EXISTS idx_visit_workers_worker ON visit_workers(worker_id);
CREATE INDEX IF NOT EXISTS idx_visit_workers_salon  ON visit_workers(salon_id);

-- Migrate existing single-worker data into the new table
INSERT INTO visit_workers (visit_id, worker_id, salon_id)
SELECT id, worker_id, salon_id
FROM visits
WHERE worker_id IS NOT NULL
ON CONFLICT DO NOTHING;
