-- Workers Table
-- Separate from staff (system users). Workers are all salon employees
-- who provide services. A person can be both a system user (staff) AND a worker.

CREATE TABLE IF NOT EXISTS workers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id    UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  name        VARCHAR NOT NULL,
  phone       VARCHAR,
  email       VARCHAR,
  job_title   VARCHAR NOT NULL DEFAULT 'Stylist',
  hire_date   DATE,
  notes       TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at  TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workers_salon ON workers(salon_id, is_active);

-- visits: replace served_by (references staff) with worker_id (references workers)
ALTER TABLE visits ADD COLUMN IF NOT EXISTS worker_id UUID REFERENCES workers(id);

-- staff_ratings: add worker_id, make staff_id nullable (old ratings keep staff_id)
ALTER TABLE staff_ratings ADD COLUMN IF NOT EXISTS worker_id UUID REFERENCES workers(id);
ALTER TABLE staff_ratings ALTER COLUMN staff_id DROP NOT NULL;
