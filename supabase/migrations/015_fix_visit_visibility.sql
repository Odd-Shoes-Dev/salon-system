-- Fix visits visibility issue: ensure all existing visits are marked as active
-- This addresses the case where visits exist but don't show in the website due to is_active not being set properly

UPDATE visits
SET is_active = true,
    deleted_at = NULL,
    deleted_by = NULL
WHERE is_active IS NULL OR is_active = false;

-- Ensure the constraint is properly set
ALTER TABLE visits
  ALTER COLUMN is_active SET DEFAULT true,
  ALTER COLUMN is_active SET NOT NULL;

-- Also check clients - should be active by default
UPDATE clients
SET is_active = true,
    deleted_at = NULL
WHERE is_active IS NULL OR is_active = false;

ALTER TABLE clients
  ALTER COLUMN is_active SET DEFAULT true,
  ALTER COLUMN is_active SET NOT NULL;

-- Services as well
UPDATE services
SET is_active = true,
    deleted_at = NULL
WHERE is_active IS NULL OR is_active = false;

ALTER TABLE services
  ALTER COLUMN is_active SET DEFAULT true,
  ALTER COLUMN is_active SET NOT NULL;
