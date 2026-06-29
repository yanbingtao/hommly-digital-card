-- Optional sender social/contact links on digital cards

ALTER TABLE digital_cards
  ADD COLUMN IF NOT EXISTS show_sender_links boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sender_links jsonb;
