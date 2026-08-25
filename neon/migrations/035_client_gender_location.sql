-- Add gender and location to clients, filled in progressively (existing rows stay NULL until edited).
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS gender   VARCHAR,
  ADD COLUMN IF NOT EXISTS location VARCHAR;
