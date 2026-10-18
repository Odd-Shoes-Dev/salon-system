-- Proper double-entry for the two debtor/creditor cases that previously had
-- none: staff advances (money owed TO the salon) and other liabilities /
-- loans (money the salon owes). Both mirror the partial-payment +
-- account_transactions pattern already used correctly by supplier_payables.

-- ── Part A: Staff Advances (Debtors) ─────────────────────────────────────
ALTER TABLE staff_advances
  ADD COLUMN account_id    uuid REFERENCES accounts(id),
  ADD COLUMN amount_repaid numeric(14,0) NOT NULL DEFAULT 0;

ALTER TABLE staff_advances DROP CONSTRAINT staff_advances_status_check;
ALTER TABLE staff_advances ADD CONSTRAINT staff_advances_status_check
  CHECK (status IN ('pending','partial','deducted','cancelled'));

-- Backfill: one existing row (200,000 UGX, status='deducted') predates any
-- repayment tracking. Confirmed with the salon owner it was actually fully
-- repaid, so mark it settled rather than letting it appear as an outstanding
-- receivable once the balance sheet starts counting amount_repaid.
UPDATE staff_advances SET amount_repaid = amount WHERE status = 'deducted';

CREATE TABLE staff_advance_repayments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id    uuid NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  advance_id  uuid NOT NULL REFERENCES staff_advances(id) ON DELETE CASCADE,
  amount      numeric(14,0) NOT NULL CHECK (amount > 0),
  method      varchar NOT NULL CHECK (method IN ('cash','salary_deduction')),
  account_id  uuid REFERENCES accounts(id),  -- set only when method='cash'
  notes       text,
  recorded_by uuid REFERENCES staff(id),
  repaid_at   timestamptz DEFAULT now()
);

-- ── Part B: Loans / Other Liabilities (Creditors) ────────────────────────
ALTER TABLE other_liabilities ADD COLUMN account_id uuid REFERENCES accounts(id);

CREATE TABLE other_liability_repayments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id     uuid NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  liability_id uuid NOT NULL REFERENCES other_liabilities(id) ON DELETE CASCADE,
  amount       numeric(14,0) NOT NULL CHECK (amount > 0),
  account_id   uuid REFERENCES accounts(id),
  notes        text,
  recorded_by  uuid REFERENCES staff(id),
  repaid_at    timestamptz DEFAULT now()
);
