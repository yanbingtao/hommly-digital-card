-- Track first publish date for 6-month card availability (republish does not reset).
ALTER TABLE digital_cards
  ADD COLUMN IF NOT EXISTS first_published_at timestamptz;

UPDATE digital_cards
SET first_published_at = published_at
WHERE first_published_at IS NULL
  AND published_at IS NOT NULL
  AND status = 'published';
