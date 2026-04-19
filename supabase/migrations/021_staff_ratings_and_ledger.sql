-- Staff Ratings & Ledger
-- staff_ratings: client feedback on the staff member who served them
-- visits.served_by: who actually performed the service (may differ from staff_id = who recorded it)

-- Who physically performed the service on this visit
ALTER TABLE visits
  ADD COLUMN IF NOT EXISTS served_by UUID REFERENCES staff(id);

-- Back-fill: default served_by to whoever created the transaction
UPDATE visits SET served_by = staff_id WHERE served_by IS NULL;

-- Client ratings on staff members (one per visit)
CREATE TABLE IF NOT EXISTS staff_ratings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id    UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  visit_id    UUID NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
  staff_id    UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  client_id   UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  rating      INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment     TEXT,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(visit_id)  -- one rating per visit
);

CREATE INDEX IF NOT EXISTS idx_staff_ratings_staff   ON staff_ratings(salon_id, staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_ratings_client  ON staff_ratings(salon_id, client_id);
CREATE INDEX IF NOT EXISTS idx_visits_served_by      ON visits(salon_id, served_by);
