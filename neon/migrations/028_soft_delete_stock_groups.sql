-- Migration 028: soft delete for stock_groups
-- Groups are now soft-deleted (deleted_at) consistent with stock_items.
-- Deletion is blocked at the API level if the group still has active items
-- or active sub-groups — those must be cleared first.

ALTER TABLE stock_groups
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
