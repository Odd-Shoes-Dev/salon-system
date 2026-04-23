-- Demo Salon Tenant Setup
-- Creates a complete demo salon with sample data for showcasing the system
-- Note: Run each section separately if you get errors

-- 1. Create demo salon
INSERT INTO salons (
  name,
  phone,
  email,
  address,
  city,
  subdomain,
  theme_primary_color,
  theme_secondary_color,
  slogan,
  is_active
) VALUES (
  'Demo Salon',
  '+256700000099',
  'demo@salon.com',
  '123 Demo Street',
  'Kampala',
  'demo',
  '#E31C23',
  '#1F2937',
  'Experience Premium Beauty Services',
  true
);

-- 2. Create demo owner account
INSERT INTO staff (
  salon_id,
  name,
  phone,
  email,
  role,
  password_hash,
  is_active
) VALUES (
  (SELECT id FROM salons WHERE phone = '+256700000099' LIMIT 1),
  'Demo Owner',
  '+256700000099',
  'demo@salon.com',
  'owner',
  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcg7b3XeKeUxWdeS86E36P4/KFm',
  true
);

-- 3. Create demo stylists
INSERT INTO staff (
  salon_id,
  name,
  phone,
  email,
  role,
  commission_rate,
  is_active
) VALUES
  ((SELECT id FROM salons WHERE phone = '+256700000099' LIMIT 1), 'Sarah Johnson', '+256701234567', 'sarah@demo.com', 'stylist', 15.00, true),
  ((SELECT id FROM salons WHERE phone = '+256700000099' LIMIT 1), 'Maria Garcia', '+256702345678', 'maria@demo.com', 'stylist', 15.00, true),
  ((SELECT id FROM salons WHERE phone = '+256700000099' LIMIT 1), 'Emma Wilson', '+256703456789', 'emma@demo.com', 'stylist', 12.00, true);

-- 4. Create demo services
INSERT INTO services (
  salon_id,
  name,
  description,
  price,
  duration_minutes,
  category,
  gender_target,
  is_active
) VALUES
  ((SELECT id FROM salons WHERE phone = '+256700000099' LIMIT 1), 'Basic Manicure', 'Classic manicure with polish', 25000, 30, 'Nails', 'female', true),
  ((SELECT id FROM salons WHERE phone = '+256700000099' LIMIT 1), 'Gel Manicure', 'Long-lasting gel polish', 35000, 45, 'Nails', 'female', true),
  ((SELECT id FROM salons WHERE phone = '+256700000099' LIMIT 1), 'Acrylic Nails', 'Full acrylic nail set', 45000, 60, 'Nails', 'female', true),
  ((SELECT id FROM salons WHERE phone = '+256700000099' LIMIT 1), 'Nail Art', 'Custom nail art design', 50000, 45, 'Nails', 'female', true),
  ((SELECT id FROM salons WHERE phone = '+256700000099' LIMIT 1), 'Basic Pedicure', 'Classic pedicure with polish', 30000, 40, 'Nails', 'female', true),
  ((SELECT id FROM salons WHERE phone = '+256700000099' LIMIT 1), 'Gel Pedicure', 'Long-lasting gel pedicure', 40000, 50, 'Nails', 'female', true),
  ((SELECT id FROM salons WHERE phone = '+256700000099' LIMIT 1), 'Hair Cut', 'Professional hair cut', 20000, 30, 'Hair', 'unisex', true),
  ((SELECT id FROM salons WHERE phone = '+256700000099' LIMIT 1), 'Hair Coloring', 'Full hair color treatment', 60000, 90, 'Hair', 'female', true),
  ((SELECT id FROM salons WHERE phone = '+256700000099' LIMIT 1), 'Hair Styling', 'Blow dry and styling', 25000, 45, 'Hair', 'female', true),
  ((SELECT id FROM salons WHERE phone = '+256700000099' LIMIT 1), 'Facial Treatment', 'Deep cleansing facial', 40000, 60, 'Spa', 'unisex', true),
  ((SELECT id FROM salons WHERE phone = '+256700000099' LIMIT 1), 'Massage', 'Full body relaxation massage', 80000, 60, 'Spa', 'unisex', true),
  ((SELECT id FROM salons WHERE phone = '+256700000099' LIMIT 1), 'Eyebrow Threading', 'Precision eyebrow shaping', 15000, 20, 'Beauty', 'female', true);

-- 5. Create demo clients
INSERT INTO clients (
  salon_id,
  name,
  phone,
  email,
  birthday,
  loyalty_points,
  total_visits,
  total_spent,
  last_visit,
  notes
) VALUES
  ((SELECT id FROM salons WHERE phone = '+256700000099' LIMIT 1), 'Alice Nakimuli', '+256701111111', 'alice@email.com', '1990-05-15', 150, 8, 280000, NOW() - INTERVAL '2 days', 'Prefers gel nails'),
  ((SELECT id FROM salons WHERE phone = '+256700000099' LIMIT 1), 'Betty Ssemanda', '+256702222222', 'betty@email.com', '1992-08-22', 200, 12, 420000, NOW() - INTERVAL '5 days', 'Regular customer'),
  ((SELECT id FROM salons WHERE phone = '+256700000099' LIMIT 1), 'Catherine Ouma', '+256703333333', 'catherine@email.com', '1988-03-10', 100, 5, 175000, NOW() - INTERVAL '10 days', 'New client'),
  ((SELECT id FROM salons WHERE phone = '+256700000099' LIMIT 1), 'Diana Kipchoge', '+256704444444', 'diana@email.com', '1995-11-30', 250, 15, 525000, NOW() - INTERVAL '1 day', 'VIP customer'),
  ((SELECT id FROM salons WHERE phone = '+256700000099' LIMIT 1), 'Eve Mwangi', '+256705555555', 'eve@email.com', '1991-07-18', 75, 3, 105000, NOW() - INTERVAL '20 days', 'Occasional visitor');

-- Demo Login Credentials:
-- PIN Login: Phone: +256700000099, PIN: 1234
-- Email Login: demo@salon.com, Password: password
-- Subdomain: demo (access at demo.localhost:3001 or demo.yourdomain.com)
