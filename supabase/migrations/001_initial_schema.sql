-- Blue Ox Salon Management Platform - Database Schema
-- Multi-tenant SaaS platform for salons
-- Run this in your Supabase project

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Salons table (multi-branch support)
CREATE TABLE salons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(255),
  address TEXT,
  city VARCHAR(100),
  logo_url TEXT,
  loyalty_points_per_ugx INTEGER DEFAULT 1, -- Points per 1000 UGX
  loyalty_threshold INTEGER DEFAULT 1000, -- Points needed for free service
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Clients table
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID REFERENCES salons(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL UNIQUE,
  email VARCHAR(255),
  birthday DATE,
  loyalty_points INTEGER DEFAULT 0,
  total_visits INTEGER DEFAULT 0,
  total_spent DECIMAL(12, 2) DEFAULT 0,
  last_visit TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Services table
CREATE TABLE services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID REFERENCES salons(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  duration_minutes INTEGER DEFAULT 30,
  category VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Staff table
CREATE TABLE staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID REFERENCES salons(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(255),
  role VARCHAR(50) DEFAULT 'stylist', -- owner, manager, stylist, cashier
  is_active BOOLEAN DEFAULT true,
  daily_sales_target DECIMAL(10, 2),
  daily_sales DECIMAL(10, 2) DEFAULT 0, -- Actual daily sales (resets daily)
  commission_rate DECIMAL(5, 2), -- Percentage
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Visits/Transactions table
CREATE TABLE visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID REFERENCES salons(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  receipt_number VARCHAR(50) UNIQUE NOT NULL,
  total_amount DECIMAL(10, 2) NOT NULL,
  payment_method VARCHAR(20) NOT NULL, -- mtn, airtel, cash
  payment_status VARCHAR(20) DEFAULT 'pending', -- pending, completed, failed
  transaction_id VARCHAR(100),
  points_earned INTEGER DEFAULT 0,
  points_redeemed INTEGER DEFAULT 0,
  whatsapp_sent BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Visit services (line items)
CREATE TABLE visit_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id UUID REFERENCES visits(id) ON DELETE CASCADE,
  service_id UUID REFERENCES services(id) ON DELETE CASCADE,
  quantity INTEGER DEFAULT 1,
  price DECIMAL(10, 2) NOT NULL, -- Price at time of visit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Loyalty tiers table
CREATE TABLE loyalty_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID REFERENCES salons(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  points_required INTEGER NOT NULL,
  reward_description TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- WhatsApp messages log
CREATE TABLE whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID REFERENCES salons(id) ON DELETE CASCADE,
  visit_id UUID REFERENCES visits(id) ON DELETE SET NULL,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  phone_number VARCHAR(20) NOT NULL,
  message TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'pending', -- pending, sent, delivered, failed
  message_id VARCHAR(100),
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_clients_salon ON clients(salon_id);
CREATE INDEX idx_clients_phone ON clients(phone);
CREATE INDEX idx_services_salon ON services(salon_id);
CREATE INDEX idx_services_active ON services(is_active);
CREATE INDEX idx_visits_salon ON visits(salon_id);
CREATE INDEX idx_visits_client ON visits(client_id);
CREATE INDEX idx_visits_created ON visits(created_at DESC);
CREATE INDEX idx_visit_services_visit ON visit_services(visit_id);
CREATE INDEX idx_staff_salon ON staff(salon_id);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply update trigger to all tables
CREATE TRIGGER update_salons_updated_at BEFORE UPDATE ON salons
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_services_updated_at BEFORE UPDATE ON services
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_staff_updated_at BEFORE UPDATE ON staff
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_visits_updated_at BEFORE UPDATE ON visits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_loyalty_tiers_updated_at BEFORE UPDATE ON loyalty_tiers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_whatsapp_messages_updated_at BEFORE UPDATE ON whatsapp_messages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert demo data for testing
INSERT INTO salons (name, phone, email, address, city, loyalty_points_per_ugx, loyalty_threshold) VALUES
('POSH Grooming Lounge - Kampala', '+256 700 123 456', 'kampala@poshsalon.com', 'Plot 123 Kampala Road', 'Kampala', 1, 1000);

-- Get the salon ID for demo data
DO $$
DECLARE
  demo_salon_id UUID;
BEGIN
  SELECT id INTO demo_salon_id FROM salons LIMIT 1;

  -- Insert demo services
  INSERT INTO services (salon_id, name, description, price, duration_minutes, category) VALUES
  (demo_salon_id, 'Luxury Beard Trim', 'Professional beard shaping and styling', 35000, 30, 'Grooming'),
  (demo_salon_id, 'Premium Haircut', 'Expert haircut with consultation', 50000, 45, 'Haircut'),
  (demo_salon_id, 'Face Treatment', 'Deep cleanse and moisturizing treatment', 75000, 60, 'Treatment'),
  (demo_salon_id, 'Classic Shave', 'Traditional hot towel shave', 40000, 30, 'Grooming'),
  (demo_salon_id, 'Hair Color', 'Professional hair coloring service', 120000, 90, 'Haircut'),
  (demo_salon_id, 'Scalp Massage', 'Relaxing scalp massage therapy', 30000, 20, 'Treatment');

  -- Insert demo staff
  INSERT INTO staff (salon_id, name, phone, email, role, daily_sales_target, commission_rate) VALUES
  (demo_salon_id, 'John Stylist', '+256 701 111 111', 'john@elitestudio.com', 'stylist', 500000, 10),
  (demo_salon_id, 'Mary Manager', '+256 702 222 222', 'mary@elitestudio.com', 'manager', 0, 0);

  -- Insert demo clients
  INSERT INTO clients (salon_id, name, phone, email, loyalty_points, total_visits, total_spent) VALUES
  (demo_salon_id, 'James Mukasa', '+256 700 111 222', 'james@example.com', 500, 5, 250000),
  (demo_salon_id, 'Sarah Nalongo', '+256 701 333 444', 'sarah@example.com', 800, 8, 400000),
  (demo_salon_id, 'David Okello', '+256 702 555 666', 'david@example.com', 300, 3, 150000);

  -- Insert demo loyalty tiers
  INSERT INTO loyalty_tiers (salon_id, name, points_required, reward_description) VALUES
  (demo_salon_id, 'Bronze', 500, 'Free beard trim'),
  (demo_salon_id, 'Silver', 1000, 'Free premium haircut'),
  (demo_salon_id, 'Gold', 2000, 'Free face treatment');
END $$;

-- Row Level Security (RLS) Policies
ALTER TABLE salons ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;

-- For demo, allow all operations (in production, restrict based on auth)
CREATE POLICY "Allow all for demo" ON salons FOR ALL USING (true);
CREATE POLICY "Allow all for demo" ON clients FOR ALL USING (true);
CREATE POLICY "Allow all for demo" ON services FOR ALL USING (true);
CREATE POLICY "Allow all for demo" ON staff FOR ALL USING (true);
CREATE POLICY "Allow all for demo" ON visits FOR ALL USING (true);
CREATE POLICY "Allow all for demo" ON visit_services FOR ALL USING (true);
CREATE POLICY "Allow all for demo" ON loyalty_tiers FOR ALL USING (true);
CREATE POLICY "Allow all for demo" ON whatsapp_messages FOR ALL USING (true);
