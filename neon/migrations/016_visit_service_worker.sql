-- Track which worker performed each service line item and link add-ons to their parent service

ALTER TABLE visit_services
  ADD COLUMN IF NOT EXISTS worker_id uuid REFERENCES workers(id) ON DELETE SET NULL;

ALTER TABLE visit_addons
  ADD COLUMN IF NOT EXISTS visit_service_id uuid REFERENCES visit_services(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_visit_services_worker ON visit_services(worker_id);
CREATE INDEX IF NOT EXISTS idx_visit_addons_service  ON visit_addons(visit_service_id);
