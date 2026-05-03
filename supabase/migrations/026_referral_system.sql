-- Referral sources (how clients discovered the salon)
CREATE TABLE IF NOT EXISTS referral_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  name varchar NOT NULL,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamp DEFAULT now(),
  UNIQUE(salon_id, name)
);

-- Seed default sources for every existing salon
INSERT INTO referral_sources (salon_id, name, sort_order)
SELECT id, 'Friend / Family',  1 FROM salons ON CONFLICT DO NOTHING;
INSERT INTO referral_sources (salon_id, name, sort_order)
SELECT id, 'Instagram',        2 FROM salons ON CONFLICT DO NOTHING;
INSERT INTO referral_sources (salon_id, name, sort_order)
SELECT id, 'Facebook',         3 FROM salons ON CONFLICT DO NOTHING;
INSERT INTO referral_sources (salon_id, name, sort_order)
SELECT id, 'TikTok',           4 FROM salons ON CONFLICT DO NOTHING;
INSERT INTO referral_sources (salon_id, name, sort_order)
SELECT id, 'Google',           5 FROM salons ON CONFLICT DO NOTHING;
INSERT INTO referral_sources (salon_id, name, sort_order)
SELECT id, 'Walk-in',          6 FROM salons ON CONFLICT DO NOTHING;
INSERT INTO referral_sources (salon_id, name, sort_order)
SELECT id, 'Other',            7 FROM salons ON CONFLICT DO NOTHING;

-- Referral tracking on clients
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS referral_source_id uuid REFERENCES referral_sources(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS referred_by_client_id uuid REFERENCES clients(id) ON DELETE SET NULL;

-- Configurable points reward per referral on the salon
ALTER TABLE salons
  ADD COLUMN IF NOT EXISTS referral_points_reward integer DEFAULT 50;
