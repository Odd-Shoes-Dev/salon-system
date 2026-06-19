-- Add voided_at / voided_by columns to visits for void-transaction support

ALTER TABLE visits
  ADD COLUMN IF NOT EXISTS voided_at timestamptz,
  ADD COLUMN IF NOT EXISTS voided_by uuid REFERENCES staff(id) ON DELETE SET NULL;
