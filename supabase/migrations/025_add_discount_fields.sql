-- Add discount tracking fields to visit_services
-- Enables per-service price editing in POS with discount tracking and staff attribution

ALTER TABLE visit_services
  ADD COLUMN IF NOT EXISTS original_price DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discounted_by UUID REFERENCES staff(id) ON DELETE SET NULL;

-- Back-fill original_price for existing rows (assume no discount on historical data)
UPDATE visit_services
SET original_price = unit_price
WHERE original_price IS NULL;
