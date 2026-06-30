-- Optional PIN protection for published card viewing

ALTER TABLE digital_cards
  ADD COLUMN IF NOT EXISTS view_pin_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS view_pin_hash text;
