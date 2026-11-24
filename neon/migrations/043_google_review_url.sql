-- Optional per-salon Google review deep link, shown in the booking site footer.
ALTER TABLE salons
  ADD COLUMN IF NOT EXISTS google_review_url text;
