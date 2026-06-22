-- Add edit tracking columns to visits table
-- Safe to re-run: IF NOT EXISTS prevents errors
ALTER TABLE visits ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;
ALTER TABLE visits ADD COLUMN IF NOT EXISTS edited_by UUID;
