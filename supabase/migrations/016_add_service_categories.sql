-- Add service_categories table for dynamic category management
-- Replaces hardcoded categories in the application

CREATE TABLE IF NOT EXISTS service_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL,
  name character varying NOT NULL,
  description text,
  color character varying DEFAULT '#E31C23',
  icon character varying,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone,
  PRIMARY KEY (id),
  FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE CASCADE,
  UNIQUE (salon_id, name)
);

-- Row Level Security (consistent with all other tables in this project)
ALTER TABLE service_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for demo" ON service_categories FOR ALL USING (true);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_service_categories_salon ON service_categories(salon_id);
CREATE INDEX IF NOT EXISTS idx_service_categories_active ON service_categories(salon_id, is_active);
CREATE INDEX IF NOT EXISTS idx_service_categories_sort ON service_categories(salon_id, sort_order);

-- Auto-update updated_at trigger
CREATE TRIGGER update_service_categories_updated_at
  BEFORE UPDATE ON service_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Seed default categories for existing salons
INSERT INTO service_categories (salon_id, name, color, sort_order)
SELECT 
  s.id,
  cat.name,
  cat.color,
  cat.sort_order
FROM salons s
CROSS JOIN (
  VALUES
    ('Haircut',   '#3B82F6', 1),
    ('Shaving',   '#10B981', 2),
    ('Styling',   '#8B5CF6', 3),
    ('Coloring',  '#F59E0B', 4),
    ('Treatment', '#EF4444', 5),
    ('Spa',       '#06B6D4', 6),
    ('Other',     '#6B7280', 7)
) AS cat(name, color, sort_order)
ON CONFLICT (salon_id, name) DO NOTHING;
