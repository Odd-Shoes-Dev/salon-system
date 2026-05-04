-- ─────────────────────────────────────────────────────────────────
-- ACCOUNTS & CASH FLOW SYSTEM
-- ─────────────────────────────────────────────────────────────────

-- Revenue + expense accounts per salon
CREATE TABLE IF NOT EXISTS accounts (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id    uuid        NOT NULL REFERENCES salons(id)  ON DELETE CASCADE,
  name        varchar     NOT NULL,
  type        varchar     NOT NULL CHECK (type IN ('cash','mtn_mobile_money','airtel_money','expense')),
  is_system   boolean     DEFAULT false,
  is_active   boolean     DEFAULT true,
  sort_order  integer     DEFAULT 0,
  created_at  timestamp   DEFAULT now(),
  updated_at  timestamp   DEFAULT now(),
  UNIQUE(salon_id, name)
);

-- Individual money movements
CREATE TABLE IF NOT EXISTS account_transactions (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id         uuid        NOT NULL REFERENCES salons(id)   ON DELETE CASCADE,
  account_id       uuid        NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  amount           numeric(14,0) NOT NULL CHECK (amount > 0),
  direction        varchar     NOT NULL CHECK (direction IN ('in','out')),
  description      text,
  reference_type   varchar,
  reference_id     uuid,
  recorded_by      uuid        REFERENCES staff(id) ON DELETE SET NULL,
  transaction_date date        NOT NULL DEFAULT CURRENT_DATE,
  created_at       timestamp   DEFAULT now()
);

-- Unique index prevents a visit being recorded twice
CREATE UNIQUE INDEX IF NOT EXISTS account_txn_visit_idx
  ON account_transactions (salon_id, reference_id)
  WHERE reference_type = 'visit';

-- Staff advances (loans against salary)
CREATE TABLE IF NOT EXISTS staff_advances (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id     uuid        NOT NULL REFERENCES salons(id)  ON DELETE CASCADE,
  staff_id     uuid        NOT NULL REFERENCES staff(id)   ON DELETE CASCADE,
  amount       numeric(14,0) NOT NULL CHECK (amount > 0),
  reason       text,
  status       varchar     DEFAULT 'pending' CHECK (status IN ('pending','deducted','cancelled')),
  given_by     uuid        REFERENCES staff(id) ON DELETE SET NULL,
  deducted_at  timestamp,
  created_at   timestamp   DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────
-- Convenient view: account with running balance
-- ─────────────────────────────────────────────────────────────────
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

-- ─────────────────────────────────────────────────────────────────
-- Seed three system revenue accounts for every existing salon
-- ─────────────────────────────────────────────────────────────────
INSERT INTO accounts (salon_id, name, type, is_system, sort_order)
SELECT id, 'Cash',             'cash',             true, 1 FROM salons
ON CONFLICT (salon_id, name) DO NOTHING;

INSERT INTO accounts (salon_id, name, type, is_system, sort_order)
SELECT id, 'MTN Mobile Money', 'mtn_mobile_money', true, 2 FROM salons
ON CONFLICT (salon_id, name) DO NOTHING;

INSERT INTO accounts (salon_id, name, type, is_system, sort_order)
SELECT id, 'Airtel Money',     'airtel_money',     true, 3 FROM salons
ON CONFLICT (salon_id, name) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────
-- Backfill existing visits into account_transactions
-- (unique index prevents duplicates if migration is re-run)
-- ─────────────────────────────────────────────────────────────────
INSERT INTO account_transactions
  (salon_id, account_id, amount, direction, description, reference_type, reference_id, transaction_date)
SELECT
  v.salon_id,
  a.id,
  v.total_amount,
  'in',
  'Receipt ' || v.receipt_number,
  'visit',
  v.id,
  v.created_at::date
FROM visits v
JOIN accounts a
  ON a.salon_id  = v.salon_id
 AND a.type      = v.payment_method
 AND a.is_system = true
WHERE v.total_amount > 0
ON CONFLICT DO NOTHING;
