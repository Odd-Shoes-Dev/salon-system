-- Add security re-authentication settings to salons
-- require_confirm_sensitive: gates admin/manager-only destructive actions (delete, void, deactivate)
-- require_confirm_general: gates general edit actions accessible to all staff

ALTER TABLE salons
  ADD COLUMN IF NOT EXISTS require_confirm_sensitive boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS require_confirm_general   boolean DEFAULT false;
