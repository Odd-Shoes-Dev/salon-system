-- Client portal: phone-OTP login sessions + voucher-to-client linking
-- Run manually against the shared Neon database (used by both salon-system and salon-booking).

-- client_sessions: mirrors the existing `sessions` table pattern used for staff auth.
CREATE TABLE client_sessions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  salon_id    uuid NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  token       text NOT NULL UNIQUE,
  expires_at  timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_client_sessions_token ON client_sessions(token);

-- client_otp_requests: short-lived OTP codes, hashed (never stored plaintext).
CREATE TABLE client_otp_requests (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id    uuid NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  phone       text NOT NULL,
  code_hash   text NOT NULL,
  attempts    int  NOT NULL DEFAULT 0,
  consumed_at timestamptz,
  expires_at  timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_client_otp_phone ON client_otp_requests(salon_id, phone, created_at DESC);

-- Link vouchers to a real client going forward. Existing free-text issued_to stays
-- for display/legacy — this is populated only by the new client-picker flow.
ALTER TABLE coupons ADD COLUMN client_id uuid REFERENCES clients(id) ON DELETE SET NULL;
CREATE INDEX idx_coupons_client_id ON coupons(client_id);
