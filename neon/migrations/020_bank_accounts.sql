-- Add bank account support: extend type CHECK, add bank detail columns

BEGIN;

-- Extend the type CHECK to include 'bank'
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_type_check;
ALTER TABLE accounts ADD CONSTRAINT accounts_type_check
  CHECK (type IN ('cash', 'mtn_mobile_money', 'airtel_money', 'expense', 'bank'));

-- Add optional bank detail columns
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS bank_name varchar;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS account_number varchar;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS branch_name varchar;

COMMIT;
