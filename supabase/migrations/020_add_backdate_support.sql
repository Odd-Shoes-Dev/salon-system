-- Backdate Support: separate transaction date from record creation date
-- recorded_at = when the record was actually saved in the system (always now())
-- created_at  = the business date of the transaction (can be backdated by owner/admin)

ALTER TABLE visits
  ADD COLUMN IF NOT EXISTS recorded_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Back-fill: for existing records, recorded_at = created_at (same moment)
UPDATE visits SET recorded_at = created_at WHERE recorded_at IS NULL;

-- Index for reports that filter by business date (created_at)
CREATE INDEX IF NOT EXISTS idx_visits_created_at ON visits(salon_id, created_at);
