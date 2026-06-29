-- Add bank account support: extend type CHECK, add bank detail columns, update view

BEGIN;

-- Extend the type CHECK to include 'bank'
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_type_check;
ALTER TABLE accounts ADD CONSTRAINT accounts_type_check
  CHECK (type IN ('cash', 'mtn_mobile_money', 'airtel_money', 'expense', 'bank'));

-- Add optional bank detail columns
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS bank_name varchar;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS account_number varchar;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS branch_name varchar;

-- Recreate the view to include bank detail columns
CREATE OR REPLACE VIEW account_balances AS
SELECT
  a.id,
  a.salon_id,
  a.name,
  a.type,
  a.is_system,
  a.is_active,
  a.sort_order,
  a.bank_name,
  a.account_number,
  a.branch_name,
  COALESCE(
    SUM(CASE WHEN t.direction = 'in' THEN t.amount ELSE -t.amount END),
    0
  )::bigint AS balance
FROM accounts a
LEFT JOIN account_transactions t ON t.account_id = a.id
GROUP BY a.id;

COMMIT;
