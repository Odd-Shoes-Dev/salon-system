-- Track when a coupon was physically handed to a client (dispatched state)
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS dispatched_at  TIMESTAMPTZ;
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS dispatched_by  UUID REFERENCES staff(id);

CREATE INDEX IF NOT EXISTS idx_coupons_dispatched ON coupons (salon_id, dispatched_at) WHERE dispatched_at IS NOT NULL;
