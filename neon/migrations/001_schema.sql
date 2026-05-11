-- ============================================================
-- SALON SYSTEM – NEON POSTGRESQL SCHEMA
-- Consolidated from all 33 Supabase migrations
-- Run this on a fresh Neon database to set up the full schema
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── SALONS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS salons (
  id                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                      varchar     NOT NULL,
  phone                     varchar     NOT NULL,
  email                     varchar,
  address                   text,
  city                      varchar,
  logo_url                  text,
  loyalty_points_per_ugx    integer     DEFAULT 1,
  loyalty_threshold         integer     DEFAULT 1000,
  subdomain                 varchar     UNIQUE,
  custom_domain             varchar,
  theme_primary_color       varchar     DEFAULT '#2563EB',
  theme_secondary_color     varchar     DEFAULT '#F59E0B',
  is_active                 boolean     DEFAULT true,
  subscription_plan         varchar     DEFAULT 'trial',
  subscription_expires_at   timestamptz,
  slogan                    varchar,
  birthday_discount_percent integer     DEFAULT 0,
  birthday_sms_template     text,
  referral_points_reward    integer     DEFAULT 50,
  referral_sms_enabled      boolean     DEFAULT true,
  birthday_sms_enabled      boolean     DEFAULT true,
  whatsapp_phone_number_id  varchar,
  whatsapp_phone_number     varchar,
  whatsapp_status           varchar     DEFAULT 'pending',
  created_at                timestamptz DEFAULT now(),
  updated_at                timestamptz DEFAULT now()
);

-- ── STAFF ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS staff (
  id               uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id         uuid    NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  name             varchar NOT NULL,
  phone            varchar NOT NULL,
  email            varchar,
  role             varchar DEFAULT 'stylist',
  is_active        boolean DEFAULT true,
  daily_sales_target numeric,
  daily_sales      numeric DEFAULT 0,
  commission_rate  numeric,
  pin_hash         varchar,
  password_hash    varchar,
  last_login       timestamptz,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_salon_phone
  ON staff(salon_id, phone);

CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_salon_email
  ON staff(salon_id, email)
  WHERE email IS NOT NULL;

-- ── SESSIONS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
  id         uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id   uuid    NOT NULL REFERENCES staff(id)  ON DELETE CASCADE,
  salon_id   uuid    NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  token      varchar NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);

-- ── CLIENTS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clients (
  id                    uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id              uuid    NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  name                  varchar NOT NULL,
  phone                 varchar NOT NULL,
  email                 varchar,
  birthday              date,
  loyalty_points        integer DEFAULT 0,
  total_visits          integer DEFAULT 0,
  total_spent           numeric DEFAULT 0,
  last_visit            timestamptz,
  notes                 text,
  is_active             boolean DEFAULT true,
  deleted_at            timestamptz,
  referral_source_id    uuid,   -- FK added below
  referred_by_client_id uuid,   -- FK added below
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now(),
  UNIQUE(salon_id, phone)
);

-- Self-referencing FK (after table creation)
ALTER TABLE clients
  ADD CONSTRAINT clients_referred_by_client_fkey
  FOREIGN KEY (referred_by_client_id) REFERENCES clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_clients_salon ON clients(salon_id) WHERE is_active = true AND deleted_at IS NULL;

-- ── SERVICES ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS services (
  id               uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id         uuid    NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  name             varchar NOT NULL,
  description      text,
  price            numeric NOT NULL,
  duration_minutes integer DEFAULT 30,
  category         varchar,
  category_id      uuid,   -- FK added after categories table
  is_active        boolean DEFAULT true,
  deleted_at       timestamptz,
  gender_target    varchar DEFAULT 'all',
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_services_salon ON services(salon_id) WHERE is_active = true AND deleted_at IS NULL;

-- ── SERVICE CATEGORIES ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS service_categories (
  id         uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id   uuid    NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  name       varchar NOT NULL,
  color      varchar DEFAULT '#6366f1',
  sort_order integer DEFAULT 0,
  is_active  boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(salon_id, name)
);

ALTER TABLE services
  ADD CONSTRAINT services_category_id_fkey
  FOREIGN KEY (category_id) REFERENCES service_categories(id) ON DELETE SET NULL;

-- ── WORKERS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workers (
  id        uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id  uuid    NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  name      varchar NOT NULL,
  phone     varchar,
  email     varchar,
  job_title varchar NOT NULL DEFAULT 'Stylist',
  hire_date date,
  notes     text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workers_salon ON workers(salon_id, is_active);

-- ── VISITS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS visits (
  id             uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id       uuid    NOT NULL REFERENCES salons(id)    ON DELETE CASCADE,
  client_id      uuid    NOT NULL REFERENCES clients(id)   ON DELETE RESTRICT,
  staff_id       uuid    REFERENCES staff(id)              ON DELETE SET NULL,
  worker_id      uuid    REFERENCES workers(id)            ON DELETE SET NULL,
  served_by      uuid    REFERENCES staff(id)              ON DELETE SET NULL,
  receipt_number varchar NOT NULL UNIQUE,
  total_amount   numeric NOT NULL,
  payment_method varchar NOT NULL,
  payment_status varchar DEFAULT 'pending',
  transaction_id varchar,
  points_earned  integer DEFAULT 0,
  points_redeemed integer DEFAULT 0,
  whatsapp_sent  boolean DEFAULT false,
  notes          text,
  is_active      boolean NOT NULL DEFAULT true,
  deleted_at     timestamptz,
  deleted_by     uuid REFERENCES staff(id) ON DELETE SET NULL,
  status         varchar DEFAULT 'completed',
  recorded_at    timestamptz DEFAULT now(),
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_visits_salon_date ON visits(salon_id, created_at DESC) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_visits_client     ON visits(client_id, created_at DESC);

-- ── VISIT SERVICES ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS visit_services (
  id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id        uuid    NOT NULL REFERENCES visits(id)   ON DELETE CASCADE,
  service_id      uuid    NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
  quantity        integer DEFAULT 1,
  price           numeric NOT NULL,
  unit_price      numeric NOT NULL,
  original_price  numeric,
  discount_amount numeric NOT NULL DEFAULT 0,
  discounted_by   uuid REFERENCES staff(id) ON DELETE SET NULL,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_visit_services_visit ON visit_services(visit_id);

-- ── SERVICE ADD-ONS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS service_addons (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id    uuid    NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  name        varchar NOT NULL,
  price       numeric(12,0) NOT NULL DEFAULT 0 CHECK (price >= 0),
  description text,
  is_active   boolean DEFAULT true,
  sort_order  integer DEFAULT 0,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS visit_addons (
  id            uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id      uuid    NOT NULL REFERENCES visits(id)        ON DELETE CASCADE,
  addon_id      uuid    NOT NULL REFERENCES service_addons(id) ON DELETE RESTRICT,
  salon_id      uuid    NOT NULL REFERENCES salons(id)         ON DELETE CASCADE,
  quantity      integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  price_at_time numeric(12,0) NOT NULL,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_visit_addons_visit ON visit_addons(visit_id);

-- ── STAFF RATINGS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS staff_ratings (
  id        uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id  uuid    NOT NULL REFERENCES salons(id)   ON DELETE CASCADE,
  visit_id  uuid    NOT NULL REFERENCES visits(id)   ON DELETE CASCADE,
  staff_id  uuid    REFERENCES staff(id)             ON DELETE CASCADE,
  worker_id uuid    REFERENCES workers(id)           ON DELETE CASCADE,
  client_id uuid    NOT NULL REFERENCES clients(id)  ON DELETE CASCADE,
  rating    integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment   text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(visit_id)
);

CREATE INDEX IF NOT EXISTS idx_staff_ratings_staff  ON staff_ratings(salon_id, staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_ratings_worker ON staff_ratings(salon_id, worker_id);

-- ── LOYALTY TIERS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS loyalty_tiers (
  id                 uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id           uuid    NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  name               varchar NOT NULL,
  points_required    integer NOT NULL,
  reward_description text    NOT NULL,
  is_active          boolean DEFAULT true,
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now()
);

-- ── EXPENSES ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expenses (
  id             uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id       uuid    NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  category       varchar NOT NULL DEFAULT 'General',
  amount         numeric(12,2) NOT NULL CHECK (amount >= 0),
  description    text,
  expense_date   date    NOT NULL DEFAULT CURRENT_DATE,
  payment_method varchar NOT NULL DEFAULT 'cash',
  created_by     uuid    REFERENCES staff(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  deleted_at     timestamptz
);

CREATE INDEX IF NOT EXISTS idx_expenses_salon_date ON expenses(salon_id, expense_date) WHERE deleted_at IS NULL;

-- ── INVENTORY ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_groups (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id    uuid    NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  name        varchar NOT NULL,
  description text,
  color       varchar NOT NULL DEFAULT '#6366f1',
  sort_order  integer NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(salon_id, name)
);

CREATE TABLE IF NOT EXISTS stock_items (
  id            uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id      uuid    NOT NULL REFERENCES salons(id)        ON DELETE CASCADE,
  group_id      uuid    REFERENCES stock_groups(id)           ON DELETE SET NULL,
  name          varchar NOT NULL,
  description   text,
  unit          varchar NOT NULL DEFAULT 'pcs',
  current_qty   numeric(12,2) NOT NULL DEFAULT 0,
  reorder_level numeric(12,2) NOT NULL DEFAULT 0,
  cost_per_unit numeric(12,2) NOT NULL DEFAULT 0,
  supplier      varchar,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz,
  UNIQUE(salon_id, name)
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id         uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id   uuid    NOT NULL REFERENCES salons(id)        ON DELETE CASCADE,
  item_id    uuid    NOT NULL REFERENCES stock_items(id)   ON DELETE CASCADE,
  qty_change numeric(12,2) NOT NULL,
  qty_after  numeric(12,2) NOT NULL,
  reason     varchar NOT NULL DEFAULT 'adjustment',
  notes      text,
  created_by uuid    REFERENCES staff(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_item  ON stock_movements(item_id,  created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_salon ON stock_movements(salon_id, created_at DESC);

-- ── ACCOUNTS & CASH FLOW ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS accounts (
  id         uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id   uuid    NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  name       varchar NOT NULL,
  type       varchar NOT NULL CHECK (type IN ('cash','mtn_mobile_money','airtel_money','expense')),
  is_system  boolean DEFAULT false,
  is_active  boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(salon_id, name)
);

CREATE TABLE IF NOT EXISTS account_transactions (
  id               uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id         uuid    NOT NULL REFERENCES salons(id)    ON DELETE CASCADE,
  account_id       uuid    NOT NULL REFERENCES accounts(id)  ON DELETE CASCADE,
  amount           numeric(14,0) NOT NULL CHECK (amount > 0),
  direction        varchar NOT NULL CHECK (direction IN ('in','out')),
  description      text,
  reference_type   varchar,
  reference_id     uuid,
  recorded_by      uuid    REFERENCES staff(id) ON DELETE SET NULL,
  transaction_date date    NOT NULL DEFAULT CURRENT_DATE,
  created_at       timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS account_txn_visit_idx
  ON account_transactions(salon_id, reference_id)
  WHERE reference_type = 'visit';

CREATE TABLE IF NOT EXISTS staff_advances (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id    uuid    NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  staff_id    uuid    NOT NULL REFERENCES staff(id)  ON DELETE CASCADE,
  amount      numeric(14,0) NOT NULL CHECK (amount > 0),
  reason      text,
  status      varchar DEFAULT 'pending' CHECK (status IN ('pending','deducted','cancelled')),
  given_by    uuid    REFERENCES staff(id) ON DELETE SET NULL,
  deducted_at timestamptz,
  created_at  timestamptz DEFAULT now()
);

-- Account balances view
CREATE OR REPLACE VIEW account_balances AS
SELECT
  a.id,
  a.salon_id,
  a.name,
  a.type,
  a.is_system,
  a.is_active,
  a.sort_order,
  COALESCE(
    SUM(CASE WHEN t.direction = 'in' THEN t.amount ELSE -t.amount END),
    0
  )::bigint AS balance
FROM accounts a
LEFT JOIN account_transactions t ON t.account_id = a.id
GROUP BY a.id;

-- ── REFERRAL SOURCES ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS referral_sources (
  id         uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id   uuid    NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  name       varchar NOT NULL,
  is_active  boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(salon_id, name)
);

ALTER TABLE clients
  ADD CONSTRAINT clients_referral_source_fkey
  FOREIGN KEY (referral_source_id) REFERENCES referral_sources(id) ON DELETE SET NULL;

-- ── BIRTHDAY MESSAGES ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS birthday_messages (
  id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id        uuid    NOT NULL REFERENCES salons(id)   ON DELETE CASCADE,
  client_id       uuid    NOT NULL REFERENCES clients(id)  ON DELETE CASCADE,
  message_text    text    NOT NULL,
  discount_percent integer,
  status          varchar(20) DEFAULT 'sent',
  year_sent       integer NOT NULL,
  sent_at         timestamptz DEFAULT now(),
  created_at      timestamptz DEFAULT now()
);

-- ── MESSAGE TEMPLATES ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS message_templates (
  id                  uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id            uuid    NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  name                varchar NOT NULL,
  display_name        varchar NOT NULL,
  template            text    NOT NULL,
  trigger_type        varchar NOT NULL,
  trigger_delay_days  integer DEFAULT 0,
  service_category    varchar,
  is_active           boolean DEFAULT true,
  send_time           time    DEFAULT '10:00:00',
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now(),
  UNIQUE(salon_id, name)
);

-- ── BIRTHDAY CLIENTS FUNCTION ─────────────────────────────────
CREATE OR REPLACE FUNCTION get_birthday_clients(p_salon_id uuid, p_month integer)
RETURNS TABLE (
  id             uuid,
  name           varchar,
  phone          varchar,
  birthday       date,
  loyalty_points integer,
  total_visits   integer
)
LANGUAGE sql
AS $$
  SELECT id, name, phone, birthday, loyalty_points, total_visits
  FROM   clients
  WHERE  salon_id    = p_salon_id
    AND  is_active   = true
    AND  deleted_at  IS NULL
    AND  birthday    IS NOT NULL
    AND  EXTRACT(MONTH FROM birthday) = p_month
  ORDER  BY EXTRACT(DAY FROM birthday);
$$;

-- ── DEFAULT ACCOUNTS SEED (run for each salon after creation) ──
-- INSERT INTO accounts (salon_id, name, type, is_system, sort_order) VALUES
--   (${salon_id}, 'Cash',             'cash',             true, 1),
--   (${salon_id}, 'MTN Mobile Money', 'mtn_mobile_money', true, 2),
--   (${salon_id}, 'Airtel Money',     'airtel_money',     true, 3);

-- ── DEFAULT REFERRAL SOURCES (run for each salon after creation) ──
-- INSERT INTO referral_sources (salon_id, name, sort_order) VALUES
--   (${salon_id}, 'Friend / Family', 1),
--   (${salon_id}, 'Instagram',       2),
--   (${salon_id}, 'Facebook',        3),
--   (${salon_id}, 'TikTok',          4),
--   (${salon_id}, 'Google',          5),
--   (${salon_id}, 'Walk-in',         6),
--   (${salon_id}, 'Other',           7);
