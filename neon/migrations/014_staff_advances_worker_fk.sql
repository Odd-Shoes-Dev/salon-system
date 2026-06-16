-- Change staff_advances.staff_id to reference workers instead of staff
-- This allows giving advances to salon workers (selectable in sales) rather than system users

ALTER TABLE staff_advances
  DROP CONSTRAINT staff_advances_staff_id_fkey;

ALTER TABLE staff_advances
  ADD CONSTRAINT staff_advances_worker_id_fkey
  FOREIGN KEY (staff_id) REFERENCES workers(id);
