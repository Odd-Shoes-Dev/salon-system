-- Add soft-delete support so records remain in DB for audit/recovery

-- Clients soft-delete fields
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

UPDATE clients
SET is_active = true
WHERE is_active IS NULL;

ALTER TABLE clients
  ALTER COLUMN is_active SET DEFAULT true,
  ALTER COLUMN is_active SET NOT NULL;

-- Visits soft-delete fields
ALTER TABLE visits
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES staff(id) ON DELETE SET NULL;

UPDATE visits
SET is_active = true
WHERE is_active IS NULL;

ALTER TABLE visits
  ALTER COLUMN is_active SET DEFAULT true,
  ALTER COLUMN is_active SET NOT NULL;

-- Services already use is_active; add deleted_at for traceability
ALTER TABLE services
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_clients_active ON clients(salon_id, is_active);
CREATE INDEX IF NOT EXISTS idx_visits_active ON visits(salon_id, is_active);
