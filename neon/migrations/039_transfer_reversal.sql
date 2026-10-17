-- Lets a wrong transfer be corrected by reversing it (a new correcting
-- entry pair) instead of editing the original record, so the audit trail
-- shows both the mistake and the fix rather than silently rewritten history.
ALTER TABLE account_transactions ADD COLUMN IF NOT EXISTS reversed_at timestamptz;
