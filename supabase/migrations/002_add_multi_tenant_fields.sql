-- Blue Ox Platform - Multi-Tenant Enhancement
-- Add subdomain and branding fields to support multi-tenancy

-- Drop old trigger and function first
DROP TRIGGER IF EXISTS validate_subdomain_trigger ON salons;
DROP FUNCTION IF EXISTS validate_subdomain();
DROP FUNCTION IF EXISTS is_subdomain_available(VARCHAR);

-- Add multi-tenant fields to salons table
ALTER TABLE salons 
  ADD COLUMN IF NOT EXISTS subdomain VARCHAR(50) UNIQUE,
  ADD COLUMN IF NOT EXISTS custom_domain VARCHAR(255),
  ADD COLUMN IF NOT EXISTS theme_primary_color VARCHAR(7) DEFAULT '#2563EB',
  ADD COLUMN IF NOT EXISTS theme_secondary_color VARCHAR(7) DEFAULT '#F59E0B',
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS subscription_plan VARCHAR(20) DEFAULT 'trial', -- trial, basic, pro, enterprise
  ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMP WITH TIME ZONE;

-- Add indexes for fast subdomain lookups
CREATE INDEX IF NOT EXISTS idx_salons_subdomain ON salons(subdomain) WHERE subdomain IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_salons_custom_domain ON salons(custom_domain) WHERE custom_domain IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_salons_active ON salons(is_active) WHERE is_active = true;

-- Update demo salon with subdomain
UPDATE salons 
SET 
  subdomain = 'demo',
  theme_primary_color = '#10B981',
  theme_secondary_color = '#D4AF37',
  subscription_plan = 'pro'
WHERE name = 'Elite Grooming Studio';

-- Create a default salon for localhost access (for testing/development)
INSERT INTO salons (name, phone, subdomain, theme_primary_color, subscription_plan, is_active)
VALUES ('Demo Salon', '+256700000000', 'localhost', '#2563EB', 'pro', true)
ON CONFLICT (subdomain) DO NOTHING;

-- Create function to check subdomain availability
CREATE OR REPLACE FUNCTION is_subdomain_available(check_subdomain VARCHAR)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN NOT EXISTS (
    SELECT 1 FROM salons WHERE subdomain = check_subdomain
  );
END;
$$ LANGUAGE plpgsql;

-- Create function to validate subdomain format
CREATE OR REPLACE FUNCTION validate_subdomain()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if subdomain is lowercase alphanumeric with hyphens only
  IF NEW.subdomain IS NOT NULL AND NEW.subdomain !~ '^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$' THEN
    RAISE EXCEPTION 'Subdomain must be 3-50 characters, lowercase, alphanumeric, and hyphens only';
  END IF;
  
  -- Reserved subdomains (localhost allowed for development)
  IF NEW.subdomain IN ('www', 'api', 'admin', 'app', 'blueox', 'mail', 'ftp', 'staging', 'dev', 'test') THEN
    RAISE EXCEPTION 'This subdomain is reserved';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to validate subdomain on insert/update
DROP TRIGGER IF EXISTS validate_subdomain_trigger ON salons;
CREATE TRIGGER validate_subdomain_trigger
  BEFORE INSERT OR UPDATE OF subdomain ON salons
  FOR EACH ROW
  EXECUTE FUNCTION validate_subdomain();

-- Add comment for documentation
COMMENT ON COLUMN salons.subdomain IS 'Unique subdomain for tenant (e.g., "elite" for elite.blueox.com)';
COMMENT ON COLUMN salons.custom_domain IS 'Custom domain for premium tenants (e.g., "elitesalon.com")';
COMMENT ON COLUMN salons.theme_primary_color IS 'Primary brand color in hex format';
COMMENT ON COLUMN salons.theme_secondary_color IS 'Secondary brand color in hex format';
COMMENT ON COLUMN salons.subscription_plan IS 'Current subscription tier: trial, basic, pro, enterprise';
