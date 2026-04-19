-- Transaction Security: immutable completed visits, owner-only void
-- Adds a status column to visits. All existing and new transactions are
-- 'completed' by default. Only owner can void (soft-delete) a transaction.

ALTER TABLE visits
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'completed'
    CHECK (status IN ('completed', 'voided')),
  ADD COLUMN IF NOT EXISTS voided_at  TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS voided_by  UUID REFERENCES staff(id);

-- Back-fill: visits that were already soft-deleted map to 'voided'
UPDATE visits
SET    status = 'voided', voided_at = deleted_at, voided_by = deleted_by
WHERE  is_active = false AND deleted_at IS NOT NULL;

-- Index for filtering by status
CREATE INDEX IF NOT EXISTS idx_visits_status ON visits(salon_id, status);
