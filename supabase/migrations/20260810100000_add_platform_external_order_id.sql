/*
Add platform + external_order_id for automation idempotency.

UNIQUE(platform, external_order_id) when both are present.
Admin-created cards without automation identity keep NULL and remain unrestricted.
*/

ALTER TABLE digital_cards
  ADD COLUMN IF NOT EXISTS platform text,
  ADD COLUMN IF NOT EXISTS external_order_id text;

CREATE UNIQUE INDEX IF NOT EXISTS uq_digital_cards_platform_external_order_id
  ON digital_cards (platform, external_order_id)
  WHERE platform IS NOT NULL AND external_order_id IS NOT NULL;
