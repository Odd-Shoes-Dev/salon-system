-- 023_coupons.sql
-- Coupon groups, coupons, and redemption tracking

CREATE TABLE coupon_groups (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id    UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  value       NUMERIC(12,2) NOT NULL CHECK (value > 0),
  note        TEXT,
  created_by  UUID REFERENCES staff(id),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  is_active   BOOLEAN DEFAULT TRUE
);

CREATE TABLE coupons (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id        UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  group_id        UUID REFERENCES coupon_groups(id) ON DELETE SET NULL,
  code            TEXT NOT NULL,
  value           NUMERIC(12,2) NOT NULL CHECK (value > 0),
  remaining_value NUMERIC(12,2) NOT NULL CHECK (remaining_value >= 0),
  note            TEXT,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'used', 'expired', 'cancelled')),
  issued_to       TEXT,
  expires_at      DATE,
  issued_by       UUID REFERENCES staff(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(salon_id, code),
  CHECK (remaining_value <= value)
);

CREATE TABLE coupon_redemptions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id       UUID NOT NULL REFERENCES coupons(id),
  visit_id        UUID REFERENCES visits(id),
  salon_id        UUID NOT NULL REFERENCES salons(id),
  amount_used     NUMERIC(12,2) NOT NULL CHECK (amount_used > 0),
  remaining_after NUMERIC(12,2) NOT NULL CHECK (remaining_after >= 0),
  redeemed_by     UUID REFERENCES staff(id),
  redeemed_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Track coupon usage on visits
ALTER TABLE visits ADD COLUMN IF NOT EXISTS coupon_id     UUID REFERENCES coupons(id);
ALTER TABLE visits ADD COLUMN IF NOT EXISTS coupon_amount NUMERIC(12,2) DEFAULT 0;

CREATE INDEX ON coupon_groups(salon_id);
CREATE INDEX ON coupons(salon_id, code);
CREATE INDEX ON coupons(salon_id, status);
CREATE INDEX ON coupons(group_id);
CREATE INDEX ON coupon_redemptions(coupon_id);
CREATE INDEX ON coupon_redemptions(visit_id);
