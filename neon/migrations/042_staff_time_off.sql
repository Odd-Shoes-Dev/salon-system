-- Scheduled staff absences (sick leave, vacation, etc.) — a date range during
-- which a staff member shouldn't be offered as available, without touching
-- their regular weekly schedule or deactivating them entirely.
CREATE TABLE staff_time_off (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id    uuid NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  staff_id    uuid NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  start_date  date NOT NULL,
  end_date    date NOT NULL,
  reason      text,
  created_by  uuid REFERENCES staff(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);

CREATE INDEX idx_staff_time_off_staff_dates ON staff_time_off(staff_id, start_date, end_date);
CREATE INDEX idx_staff_time_off_salon ON staff_time_off(salon_id);
