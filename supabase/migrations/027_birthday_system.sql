-- Birthday message log (tracks every birthday SMS sent per client per year)
CREATE TABLE IF NOT EXISTS birthday_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  message_text text NOT NULL,
  discount_percent integer,
  status varchar(20) DEFAULT 'sent',
  year_sent integer NOT NULL,
  sent_at timestamp DEFAULT now(),
  created_at timestamp DEFAULT now()
);

-- Per-salon birthday settings
ALTER TABLE salons
  ADD COLUMN IF NOT EXISTS birthday_discount_percent integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS birthday_sms_template text;
