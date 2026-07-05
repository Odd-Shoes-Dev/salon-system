-- Allow clients to be created without a phone number
-- Salons often collect client info incrementally; phone may be added on a later visit.
-- PostgreSQL UNIQUE constraint naturally allows multiple NULLs, so no index change needed.

ALTER TABLE clients ALTER COLUMN phone DROP NOT NULL;
