-- Migration 034: Add balance tracking to visits
-- Tracks partial payments and outstanding balances per visit

-- Add new columns to visits table
ALTER TABLE visits
  ADD COLUMN IF NOT EXISTS amount_paid      NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS checkout_discount NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS balance_due      NUMERIC NOT NULL DEFAULT 0;

-- Update existing completed visits to be fully paid
-- (all prior visits were recorded as completed transactions)
UPDATE visits
SET
  amount_paid       = total_amount,
  checkout_discount = 0,
  balance_due       = 0,
  payment_status    = 'paid'
WHERE is_active = true;

-- Mark voided/deleted visits as paid too (for cleanliness)
UPDATE visits
SET
  amount_paid       = total_amount,
  checkout_discount = 0,
  balance_due       = 0,
  payment_status    = 'paid'
WHERE is_active = false AND payment_status = 'pending';

-- Add index for fast "balance due" queries (used in client balance lookups)
CREATE INDEX IF NOT EXISTS idx_visits_balance_due ON visits (salon_id, balance_due) WHERE balance_due > 0;
