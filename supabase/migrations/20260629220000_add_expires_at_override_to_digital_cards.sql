-- Admin can set a custom expiry that overrides the default 6-month rule.
ALTER TABLE digital_cards
  ADD COLUMN IF NOT EXISTS expires_at_override timestamptz;
