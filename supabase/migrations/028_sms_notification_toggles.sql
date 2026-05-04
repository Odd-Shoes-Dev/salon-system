-- SMS notification on/off controls per salon
ALTER TABLE salons
  ADD COLUMN IF NOT EXISTS referral_sms_enabled boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS birthday_sms_enabled boolean DEFAULT true;
