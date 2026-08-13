-- Card-level Edit PIN (buyer edit gate). Separate from recipient Viewing PIN.
ALTER TABLE digital_cards
  ADD COLUMN IF NOT EXISTS edit_pin_hash text,
  ADD COLUMN IF NOT EXISTS edit_pin_encrypted text,
  ADD COLUMN IF NOT EXISTS edit_pin_created_at timestamptz,
  ADD COLUMN IF NOT EXISTS edit_session_version integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN digital_cards.edit_pin_hash IS 'scrypt hash for Edit PIN verification';
COMMENT ON COLUMN digital_cards.edit_pin_encrypted IS 'AES-256-GCM ciphertext for admin reveal';
COMMENT ON COLUMN digital_cards.edit_pin_created_at IS 'When the current Edit PIN was generated';
COMMENT ON COLUMN digital_cards.edit_session_version IS 'Bumped on Edit PIN reset to invalidate sessions';

-- Distributed rate limit for Edit PIN verification (serverless-safe).
CREATE TABLE IF NOT EXISTS edit_pin_rate_limits (
  scope_key text PRIMARY KEY,
  fail_count integer NOT NULL DEFAULT 0,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  locked_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE edit_pin_rate_limits ENABLE ROW LEVEL SECURITY;
-- No anon policies: service role only.
