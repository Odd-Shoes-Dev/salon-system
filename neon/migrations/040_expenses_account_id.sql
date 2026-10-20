-- Expenses could previously only be attributed to Cash/MTN/Airtel (or left
-- entirely untracked via payment_method='other') — no way to record an
-- expense as paid from a specific bank account. account_id lets an expense
-- point at any of the salon's accounts, matching the pattern already used by
-- purchases/staff_advances/other_liabilities. Nullable: a null account_id
-- keeps today's "not tracked against any account" behavior.
ALTER TABLE expenses ADD COLUMN account_id uuid REFERENCES accounts(id);
