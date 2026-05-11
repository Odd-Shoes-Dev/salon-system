-- ============================================================
-- 003_add_booking_tables.sql
-- Custom booking system for multi-tenant salon management
-- ============================================================

-- Per-salon booking configuration
CREATE TABLE IF NOT EXISTS booking_settings (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id              UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  is_enabled            BOOLEAN NOT NULL DEFAULT true,
  buffer_minutes        INTEGER NOT NULL DEFAULT 15,      -- gap between bookings
  advance_booking_days  INTEGER NOT NULL DEFAULT 60,      -- how far ahead clients can book
  min_advance_minutes   INTEGER NOT NULL DEFAULT 60,      -- minimum lead time to book
  cancellation_hours    INTEGER NOT NULL DEFAULT 24,      -- hours before booking that cancellation allowed
  working_hours_start   TIME NOT NULL DEFAULT '09:00',    -- fallback if no staff schedule set
  working_hours_end     TIME NOT NULL DEFAULT '18:00',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(salon_id)
);

-- Weekly schedule per staff member (day_of_week: 0=Sunday … 6=Saturday)
CREATE TABLE IF NOT EXISTS staff_schedules (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id     UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  staff_id     UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  day_of_week  INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time   TIME NOT NULL,
  end_time     TIME NOT NULL,
  is_available BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(staff_id, day_of_week)
);

-- Booking records
CREATE TABLE IF NOT EXISTS bookings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id            UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  -- client: registered or guest
  client_id           UUID REFERENCES clients(id) ON DELETE SET NULL,
  guest_name          TEXT,
  guest_phone         TEXT,
  -- assignment
  staff_id            UUID NOT NULL REFERENCES workers(id) ON DELETE RESTRICT,
  service_id          UUID NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
  -- timing
  booking_date        DATE NOT NULL,
  start_time          TIME NOT NULL,
  end_time            TIME NOT NULL,
  -- status lifecycle: pending → confirmed → completed | cancelled | no_show
  status              VARCHAR(20) NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','confirmed','completed','cancelled','no_show')),
  notes               TEXT,
  cancellation_reason TEXT,
  reminder_sent       BOOLEAN NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Reminder log (for SMS / WhatsApp)
CREATE TABLE IF NOT EXISTS booking_reminders (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id   UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  method     VARCHAR(20) NOT NULL CHECK (method IN ('sms','whatsapp','email')),
  sent_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bookings_salon_date    ON bookings(salon_id, booking_date);
CREATE INDEX IF NOT EXISTS idx_bookings_staff_date    ON bookings(staff_id, booking_date);
CREATE INDEX IF NOT EXISTS idx_bookings_client        ON bookings(client_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status        ON bookings(salon_id, status);
CREATE INDEX IF NOT EXISTS idx_staff_schedules_staff  ON staff_schedules(staff_id);
CREATE INDEX IF NOT EXISTS idx_booking_reminders      ON booking_reminders(booking_id);

-- updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_booking_settings_updated_at') THEN
    CREATE TRIGGER trg_booking_settings_updated_at
      BEFORE UPDATE ON booking_settings
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_staff_schedules_updated_at') THEN
    CREATE TRIGGER trg_staff_schedules_updated_at
      BEFORE UPDATE ON staff_schedules
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_bookings_updated_at') THEN
    CREATE TRIGGER trg_bookings_updated_at
      BEFORE UPDATE ON bookings
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
