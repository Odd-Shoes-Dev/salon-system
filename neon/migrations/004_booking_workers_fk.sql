-- ============================================================
-- 004_booking_workers_fk.sql
-- Re-point booking tables from staff → workers
-- Run this if 003 was already applied when it still referenced staff(id)
-- ============================================================

-- staff_schedules: drop old FK, add new one pointing to workers
ALTER TABLE staff_schedules
  DROP CONSTRAINT IF EXISTS staff_schedules_staff_id_fkey;

ALTER TABLE staff_schedules
  ADD CONSTRAINT staff_schedules_staff_id_fkey
  FOREIGN KEY (staff_id) REFERENCES workers(id) ON DELETE CASCADE;

-- bookings: drop old FK, add new one pointing to workers
ALTER TABLE bookings
  DROP CONSTRAINT IF EXISTS bookings_staff_id_fkey;

ALTER TABLE bookings
  ADD CONSTRAINT bookings_staff_id_fkey
  FOREIGN KEY (staff_id) REFERENCES workers(id) ON DELETE RESTRICT;
