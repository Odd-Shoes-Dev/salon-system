-- ============================================================
-- 032: Unify expense system
--   1. Add payment_method to expenses table
--   2. Migrate expense-account transactions → expenses
--   3. Drop expense-type accounts (now redundant)
-- ============================================================

-- 1. Add payment_method column to expenses
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS payment_method varchar NOT NULL DEFAULT 'cash';

-- 2. Migrate existing expense-account transactions into expenses table
--    (expense accounts were named like "Rent", "Salaries" → become categories)
INSERT INTO expenses (salon_id, category, amount, description, expense_date, created_by, payment_method)
SELECT
  at.salon_id,
  a.name,
  at.amount,
  COALESCE(at.description, a.name),
  at.transaction_date,
  at.recorded_by,
  'cash'
FROM account_transactions at
JOIN accounts a ON a.id = at.account_id
WHERE a.type = 'expense'
  AND at.direction = 'out'
ON CONFLICT DO NOTHING;

-- 3. Delete expense-type account transactions first (FK constraint)
DELETE FROM account_transactions
  WHERE account_id IN (SELECT id FROM accounts WHERE type = 'expense');

-- 4. Delete expense-type accounts
DELETE FROM accounts WHERE type = 'expense';

-- 5. Tighten index (includes payment_method for filtering)
CREATE INDEX IF NOT EXISTS idx_expenses_salon_pm
  ON expenses(salon_id, payment_method)
  WHERE deleted_at IS NULL;
