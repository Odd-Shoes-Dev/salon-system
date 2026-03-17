-- Authentication System for Blue Ox Platform
-- Run this after 002_add_multi_tenant_fields.sql

-- Add authentication fields to staff table
ALTER TABLE staff 
  ADD COLUMN IF NOT EXISTS email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS pin_hash VARCHAR(255),
  ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255),
  ADD COLUMN IF NOT EXISTS last_login TIMESTAMP WITH TIME ZONE;

-- Create unique constraints
CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_email ON staff(email) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_phone ON staff(phone);

-- Create sessions table for authentication tokens
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_staff ON sessions(staff_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- Function to clean up expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM sessions WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Create demo staff accounts for testing
DO $$
DECLARE
  demo_salon_id UUID;
  localhost_salon_id UUID;
BEGIN
  -- Get the localhost salon ID for development
  SELECT id INTO localhost_salon_id FROM salons WHERE subdomain = 'localhost' LIMIT 1;
  
  IF localhost_salon_id IS NOT NULL THEN
    -- Create staff for localhost salon
    -- PIN: 1234 (hashed with bcrypt)
    -- Password: password123 (hashed with bcrypt)
    
    -- Owner account
    INSERT INTO staff (salon_id, name, phone, email, role, pin_hash, password_hash, is_active)
    VALUES (
      localhost_salon_id,
      'Admin User',
      '+256700000001',
      'admin@demo.com',
      'owner',
      '$2b$10$rZ8WqZL.VYHnKqZ3wJ3IKuXxN2qF0VwH8p9J7cYZR3H9M0kR9kRTK', -- 1234
      '$2b$10$rZ8WqZL.VYHnKqZ3wJ3IKuXxN2qF0VwH8p9J7cYZR3H9M0kR9kRTK', -- password123
      true
    )
    ON CONFLICT (phone) DO UPDATE SET
      salon_id = EXCLUDED.salon_id,
      email = EXCLUDED.email,
      pin_hash = EXCLUDED.pin_hash,
      password_hash = EXCLUDED.password_hash;
    
    -- Manager account
    INSERT INTO staff (salon_id, name, phone, email, role, pin_hash, is_active)
    VALUES (
      localhost_salon_id,
      'Manager User',
      '+256700000002',
      'manager@demo.com',
      'manager',
      '$2b$10$rZ8WqZL.VYHnKqZ3wJ3IKuXxN2qF0VwH8p9J7cYZR3H9M0kR9kRTK', -- 1234
      true
    )
    ON CONFLICT (phone) DO UPDATE SET
      salon_id = EXCLUDED.salon_id,
      email = EXCLUDED.email,
      pin_hash = EXCLUDED.pin_hash;
    
    -- Cashier account
    INSERT INTO staff (salon_id, name, phone, role, pin_hash, is_active)
    VALUES (
      localhost_salon_id,
      'Cashier User',
      '+256700000003',
      'cashier',
      '$2b$10$rZ8WqZL.VYHnKqZ3wJ3IKuXxN2qF0VwH8p9J7cYZR3H9M0kR9kRTK', -- 1234
      true
    )
    ON CONFLICT (phone) DO UPDATE SET
      salon_id = EXCLUDED.salon_id,
      pin_hash = EXCLUDED.pin_hash;
  END IF;
  
  -- Also handle demo salon if it exists
  SELECT id INTO demo_salon_id FROM salons WHERE subdomain = 'demo' LIMIT 1;
  
  IF demo_salon_id IS NOT NULL THEN
    -- Create staff for demo salon (different phone numbers)
    INSERT INTO staff (salon_id, name, phone, email, role, pin_hash, password_hash, is_active)
    VALUES (
      demo_salon_id,
      'Demo Owner',
      '+256700000011',
      'owner@demo.com',
      'owner',
      '$2b$10$rZ8WqZL.VYHnKqZ3wJ3IKuXxN2qF0VwH8p9J7cYZR3H9M0kR9kRTK',
      '$2b$10$rZ8WqZL.VYHnKqZ3wJ3IKuXxN2qF0VwH8p9J7cYZR3H9M0kR9kRTK',
      true
    )
    ON CONFLICT (phone) DO NOTHING;
  END IF;
END $$;

-- Add comments
COMMENT ON TABLE sessions IS 'User authentication sessions';
COMMENT ON COLUMN staff.pin_hash IS 'Bcrypt hashed 4-digit PIN for quick login';
COMMENT ON COLUMN staff.password_hash IS 'Bcrypt hashed password for secure login';
COMMENT ON COLUMN staff.last_login IS 'Last successful login timestamp';
