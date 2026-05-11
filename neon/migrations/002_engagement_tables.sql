-- ============================================================
-- 002 – WHATSAPP & ENGAGEMENT TABLES
-- Run this after 001_schema.sql
-- ============================================================

-- ── UPDATED_AT TRIGGER FUNCTION ───────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── WHATSAPP MESSAGES ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id     uuid        REFERENCES salons(id)  ON DELETE CASCADE,
  visit_id     uuid        REFERENCES visits(id)  ON DELETE SET NULL,
  client_id    uuid        REFERENCES clients(id) ON DELETE CASCADE,
  phone_number varchar(20) NOT NULL,
  message      text        NOT NULL,
  status       varchar(20) DEFAULT 'pending', -- pending, sent, delivered, failed
  message_id   varchar(100),
  error        text,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_salon  ON whatsapp_messages(salon_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_client ON whatsapp_messages(client_id);

-- ── WHATSAPP WEBHOOKS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS whatsapp_webhooks (
  id         uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id varchar,
  message_id varchar,
  status     varchar,
  timestamp  timestamptz,
  raw_data   jsonb,
  processed  boolean     DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- ── FEEDBACK RESPONSES ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS feedback_responses (
  id               uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id         uuid    REFERENCES salons(id)  ON DELETE CASCADE,
  client_id        uuid    REFERENCES clients(id) ON DELETE CASCADE,
  visit_id         uuid    REFERENCES visits(id)  ON DELETE CASCADE,
  staff_id         uuid    REFERENCES staff(id)   ON DELETE SET NULL,
  rating           integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  would_recommend  boolean,
  feedback_channel varchar DEFAULT 'whatsapp',
  responded_at     timestamptz DEFAULT now(),
  created_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feedback_responses_salon  ON feedback_responses(salon_id);
CREATE INDEX IF NOT EXISTS idx_feedback_responses_client ON feedback_responses(client_id);
CREATE INDEX IF NOT EXISTS idx_feedback_responses_rating ON feedback_responses(rating);

-- ── COMPLAINT CATEGORIES ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS complaint_categories (
  id               uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id         uuid    REFERENCES salons(id) ON DELETE CASCADE,
  name             varchar NOT NULL,
  display_name     varchar NOT NULL,
  description      text,
  emoji            varchar,
  severity_default varchar DEFAULT 'medium',
  auto_escalate    boolean DEFAULT false,
  sort_order       integer DEFAULT 0,
  is_active        boolean DEFAULT true,
  created_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_complaint_categories_salon ON complaint_categories(salon_id);

-- ── COMPLAINT REPORTS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS complaint_reports (
  id                   uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_response_id uuid    REFERENCES feedback_responses(id) ON DELETE CASCADE,
  salon_id             uuid    REFERENCES salons(id)             ON DELETE CASCADE,
  client_id            uuid    REFERENCES clients(id)            ON DELETE CASCADE,
  visit_id             uuid    REFERENCES visits(id)             ON DELETE CASCADE,
  staff_id             uuid    REFERENCES staff(id)              ON DELETE SET NULL,
  complaint_category   varchar NOT NULL,
  complaint_text       text,
  severity             varchar DEFAULT 'medium',
  status               varchar DEFAULT 'pending',
  resolution_notes     text,
  resolved_by          uuid    REFERENCES staff(id) ON DELETE SET NULL,
  resolved_at          timestamptz,
  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_complaint_reports_salon  ON complaint_reports(salon_id);
CREATE INDEX IF NOT EXISTS idx_complaint_reports_client ON complaint_reports(client_id);
CREATE INDEX IF NOT EXISTS idx_complaint_reports_status ON complaint_reports(status);

CREATE TRIGGER update_complaint_reports_updated_at
  BEFORE UPDATE ON complaint_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── SCHEDULED MESSAGES ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scheduled_messages (
  id                  uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id            uuid    REFERENCES salons(id)            ON DELETE CASCADE,
  client_id           uuid    REFERENCES clients(id)           ON DELETE CASCADE,
  visit_id            uuid    REFERENCES visits(id)            ON DELETE CASCADE,
  template_id         uuid    REFERENCES message_templates(id) ON DELETE SET NULL,
  phone_number        varchar NOT NULL,
  message_content     text    NOT NULL,
  scheduled_for       timestamptz NOT NULL,
  status              varchar DEFAULT 'pending',
  attempts            integer DEFAULT 0,
  max_attempts        integer DEFAULT 3,
  whatsapp_message_id varchar,
  sent_at             timestamptz,
  delivered_at        timestamptz,
  read_at             timestamptz,
  failed_reason       text,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_messages_salon         ON scheduled_messages(salon_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_status        ON scheduled_messages(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_scheduled_for ON scheduled_messages(scheduled_for);

CREATE TRIGGER update_scheduled_messages_updated_at
  BEFORE UPDATE ON scheduled_messages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── CS TASKS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cs_tasks (
  id                   uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id             uuid    REFERENCES salons(id)              ON DELETE CASCADE,
  client_id            uuid    REFERENCES clients(id)             ON DELETE CASCADE,
  scheduled_message_id uuid    REFERENCES scheduled_messages(id)  ON DELETE SET NULL,
  task_type            varchar NOT NULL,
  priority             varchar DEFAULT 'normal',
  status               varchar DEFAULT 'pending',
  title                varchar NOT NULL,
  description          text,
  assigned_to          uuid    REFERENCES staff(id) ON DELETE SET NULL,
  due_date             date,
  completed_at         timestamptz,
  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cs_tasks_salon       ON cs_tasks(salon_id);
CREATE INDEX IF NOT EXISTS idx_cs_tasks_status      ON cs_tasks(status);
CREATE INDEX IF NOT EXISTS idx_cs_tasks_assigned_to ON cs_tasks(assigned_to);

CREATE TRIGGER update_cs_tasks_updated_at
  BEFORE UPDATE ON cs_tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── RECOVERY ACTIONS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS recovery_actions (
  id                   uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id             uuid    REFERENCES salons(id)             ON DELETE CASCADE,
  client_id            uuid    REFERENCES clients(id)            ON DELETE CASCADE,
  visit_id             uuid    REFERENCES visits(id)             ON DELETE CASCADE,
  feedback_response_id uuid    REFERENCES feedback_responses(id) ON DELETE CASCADE,
  complaint_report_id  uuid    REFERENCES complaint_reports(id)  ON DELETE CASCADE,
  action_type          varchar NOT NULL,
  action_taken_by      uuid    REFERENCES staff(id) ON DELETE SET NULL,
  offer_type           varchar,
  offer_amount         numeric,
  offer_code           varchar,
  offer_expires        date,
  customer_response    text,
  outcome              varchar,
  customer_returned    boolean DEFAULT false,
  return_visit_id      uuid    REFERENCES visits(id) ON DELETE SET NULL,
  notes                text,
  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recovery_actions_salon  ON recovery_actions(salon_id);
CREATE INDEX IF NOT EXISTS idx_recovery_actions_client ON recovery_actions(client_id);

CREATE TRIGGER update_recovery_actions_updated_at
  BEFORE UPDATE ON recovery_actions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── REFERRALS ─────────────────────────────────────────────────
-- Tracks individual referral events (distinct from referral_sources lookup)
CREATE TABLE IF NOT EXISTS referrals (
  id                 uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id           uuid    REFERENCES salons(id)  ON DELETE CASCADE,
  referrer_id        uuid    REFERENCES clients(id) ON DELETE CASCADE,
  referred_client_id uuid    REFERENCES clients(id) ON DELETE CASCADE,
  referral_source    varchar DEFAULT 'word_of_mouth',
  referrer_phone     varchar,
  referrer_name      varchar,
  status             varchar DEFAULT 'pending',
  first_visit_id     uuid    REFERENCES visits(id)  ON DELETE SET NULL,
  reward_points      integer DEFAULT 500,
  rewarded_at        timestamptz,
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_referrals_salon  ON referrals(salon_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status);

CREATE TRIGGER update_referrals_updated_at
  BEFORE UPDATE ON referrals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── ENGAGE SETTINGS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS engage_settings (
  id                         uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id                   uuid    UNIQUE REFERENCES salons(id) ON DELETE CASCADE,
  feedback_enabled           boolean DEFAULT true,
  feedback_delay_hours       integer DEFAULT 9,
  auto_recovery_enabled      boolean DEFAULT true,
  manager_alert_threshold    integer DEFAULT 3,
  referral_reward_points     integer DEFAULT 500,
  referral_tracking_enabled  boolean DEFAULT true,
  staff_performance_tracking boolean DEFAULT true,
  whatsapp_feedback_enabled  boolean DEFAULT true,
  sms_feedback_fallback      boolean DEFAULT false,
  created_at                 timestamptz DEFAULT now(),
  updated_at                 timestamptz DEFAULT now()
);

CREATE TRIGGER update_engage_settings_updated_at
  BEFORE UPDATE ON engage_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── STAFF PERFORMANCE ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS staff_performance (
  id                         uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id                   uuid    REFERENCES salons(id) ON DELETE CASCADE,
  staff_id                   uuid    REFERENCES staff(id)  ON DELETE CASCADE,
  period_start               date    NOT NULL,
  period_end                 date    NOT NULL,
  total_services             integer DEFAULT 0,
  total_clients              integer DEFAULT 0,
  avg_rating                 numeric,
  five_star_count            integer DEFAULT 0,
  four_star_count            integer DEFAULT 0,
  three_star_count           integer DEFAULT 0,
  two_star_count             integer DEFAULT 0,
  one_star_count             integer DEFAULT 0,
  total_complaints           integer DEFAULT 0,
  complaints_resolved        integer DEFAULT 0,
  would_recommend_percentage numeric,
  recovery_success_count     integer DEFAULT 0,
  referrals_generated        integer DEFAULT 0,
  performance_score          numeric,
  rank                       integer,
  created_at                 timestamptz DEFAULT now(),
  updated_at                 timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_performance_salon ON staff_performance(salon_id);
CREATE INDEX IF NOT EXISTS idx_staff_performance_staff ON staff_performance(staff_id);

CREATE TRIGGER update_staff_performance_updated_at
  BEFORE UPDATE ON staff_performance
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
