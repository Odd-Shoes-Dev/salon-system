-- Percentage coupons: a fixed-value coupon that happens to equal/exceed a
-- cheap service's price fully zeroes it out, which isn't what salons mean
-- by "give a discount". A percentage coupon scales with the service price
-- instead. Percentage coupons are simple single-use (no partial/remaining
-- balance) — full value is reserved in `remaining_value` at creation and
-- redemption always sets it to 0 and marks the coupon 'used' in one go,
-- regardless of how much of the visit's total it actually discounted.

ALTER TABLE coupon_groups
  ADD COLUMN discount_type TEXT NOT NULL DEFAULT 'fixed' CHECK (discount_type IN ('fixed', 'percentage'));
ALTER TABLE coupon_groups
  ADD CONSTRAINT coupon_groups_percentage_range CHECK (discount_type = 'fixed' OR value <= 100);

ALTER TABLE coupons
  ADD COLUMN discount_type TEXT NOT NULL DEFAULT 'fixed' CHECK (discount_type IN ('fixed', 'percentage'));
ALTER TABLE coupons
  ADD CONSTRAINT coupons_percentage_range CHECK (discount_type = 'fixed' OR value <= 100);
