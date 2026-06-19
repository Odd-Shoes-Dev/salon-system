-- Replace single worker_id on visit_services with an array (supports multiple workers per service)
-- Equal-split revenue attribution in the ledger is handled in the query layer

ALTER TABLE visit_services
  DROP COLUMN IF EXISTS worker_id,
  ADD COLUMN IF NOT EXISTS worker_ids uuid[] NOT NULL DEFAULT '{}';

-- GIN index for array containment queries
CREATE INDEX IF NOT EXISTS idx_visit_services_worker_ids ON visit_services USING gin(worker_ids);
