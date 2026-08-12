/*
Phase 1 — Individual / multi-recipient foundation (schema only).

Additive changes:
- digital_cards.card_mode DEFAULT 'shared'
- digital_card_recipients table (empty until Individual creation in a later phase)

Existing shared cards keep public_token, edit_token, content, photos, and expiry on digital_cards.
No data is moved or rewritten.
*/

ALTER TABLE digital_cards
  ADD COLUMN IF NOT EXISTS card_mode text NOT NULL DEFAULT 'shared';

ALTER TABLE digital_cards
  DROP CONSTRAINT IF EXISTS digital_cards_card_mode_check;

ALTER TABLE digital_cards
  ADD CONSTRAINT digital_cards_card_mode_check
  CHECK (card_mode IN ('shared', 'individual'));

CREATE TABLE IF NOT EXISTS digital_card_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  digital_card_id uuid NOT NULL
    REFERENCES digital_cards(id)
    ON DELETE CASCADE,

  recipient_number integer NOT NULL,
  view_token text NOT NULL UNIQUE,

  message text,

  theme text NOT NULL DEFAULT 'thank_you',
  animation text NOT NULL DEFAULT 'soft_reveal',

  show_sender_links boolean NOT NULL DEFAULT false,
  sender_links jsonb,

  view_pin_enabled boolean NOT NULL DEFAULT false,
  view_pin_hash text,

  photo_path text,
  photo_original_name text,
  photo_mime_type text,
  photo_size_bytes bigint,
  photo_uploaded_at timestamptz,

  status text NOT NULL DEFAULT 'draft',
  published_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT digital_card_recipients_recipient_number_positive
    CHECK (recipient_number > 0),

  CONSTRAINT digital_card_recipients_card_recipient_unique
    UNIQUE (digital_card_id, recipient_number)
);

CREATE INDEX IF NOT EXISTS digital_card_recipients_digital_card_id_idx
  ON digital_card_recipients (digital_card_id);

-- view_token UNIQUE already creates a lookup index; explicit index omitted.

/*
RLS: enabled with no anon/authenticated policies in Phase 1.

Recipient rows are not reachable from the browser client yet (/g still resolves
digital_cards.public_token only). Service-role server code bypasses RLS.

Phase 3+ should add token-scoped SELECT policies (e.g. row visible only when
view_token matches) rather than blanket anon SELECT, to avoid listing all
recipients for a parent card.
*/
ALTER TABLE digital_card_recipients ENABLE ROW LEVEL SECURITY;
