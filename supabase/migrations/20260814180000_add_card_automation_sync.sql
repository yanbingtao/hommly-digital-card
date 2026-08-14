/*
Phase A: Admin-created card → Mac automation handoff.

Tracks creation origin and Mac sync lifecycle on digital_cards.
Existing rows default to automation_sync_status = not_required (no backfill to pending).
*/

ALTER TABLE digital_cards
  ADD COLUMN IF NOT EXISTS creation_source text,
  ADD COLUMN IF NOT EXISTS automation_sync_status text NOT NULL DEFAULT 'not_required',
  ADD COLUMN IF NOT EXISTS automation_claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS automation_ready_at timestamptz,
  ADD COLUMN IF NOT EXISTS automation_last_error text;

ALTER TABLE digital_cards
  DROP CONSTRAINT IF EXISTS digital_cards_creation_source_check;

ALTER TABLE digital_cards
  ADD CONSTRAINT digital_cards_creation_source_check
  CHECK (creation_source IS NULL OR creation_source IN ('automation', 'admin'));

ALTER TABLE digital_cards
  DROP CONSTRAINT IF EXISTS digital_cards_automation_sync_status_check;

ALTER TABLE digital_cards
  ADD CONSTRAINT digital_cards_automation_sync_status_check
  CHECK (
    automation_sync_status IN ('not_required', 'pending', 'claimed', 'ready', 'failed')
  );

COMMENT ON COLUMN digital_cards.creation_source IS
  'automation = Shopee/internal API; admin = /admin/cards manual create';

COMMENT ON COLUMN digital_cards.platform IS
  'shopee for automation; admin for manual Admin creates (no external_order_id collision)';

CREATE INDEX IF NOT EXISTS idx_digital_cards_admin_automation_queue
  ON digital_cards (created_at ASC)
  WHERE creation_source = 'admin'
    AND automation_sync_status IN ('pending', 'failed');
