-- Remove unused digital_cards columns

ALTER TABLE digital_cards
  DROP COLUMN IF EXISTS recipient_name,
  DROP COLUMN IF EXISTS sender_name,
  DROP COLUMN IF EXISTS photo_url;
