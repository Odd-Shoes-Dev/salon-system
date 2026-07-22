-- Add WhatsApp API credentials to salons table.
-- whatsapp_phone_number_id and whatsapp_phone_number already exist from migration 001.
ALTER TABLE salons
  ADD COLUMN IF NOT EXISTS whatsapp_access_token TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_verify_token  TEXT;
