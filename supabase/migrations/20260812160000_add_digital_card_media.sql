/*
Phase 5A — Individual reusable photo media (schema only).

Additive changes:
- digital_card_media table for card-scoped reusable photo assets
- digital_card_recipients.photo_media_id FK (legacy recipient photo columns retained)

Shared cards continue using digital_cards.photo_path only.
Do NOT apply automatically — review and apply via Supabase CLI when ready.
*/

CREATE TABLE IF NOT EXISTS digital_card_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  digital_card_id uuid NOT NULL
    REFERENCES digital_cards(id)
    ON DELETE CASCADE,

  storage_path text NOT NULL UNIQUE,

  original_name text,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL,

  media_type text NOT NULL DEFAULT 'photo',

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT digital_card_media_media_type_check
    CHECK (media_type IN ('photo')),

  CONSTRAINT digital_card_media_size_bytes_positive
    CHECK (size_bytes > 0)
);

CREATE INDEX IF NOT EXISTS digital_card_media_digital_card_id_idx
  ON digital_card_media (digital_card_id);

ALTER TABLE digital_card_recipients
  ADD COLUMN IF NOT EXISTS photo_media_id uuid
  REFERENCES digital_card_media(id)
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS digital_card_recipients_photo_media_id_idx
  ON digital_card_recipients (photo_media_id);

/*
RLS: enabled with no anon/authenticated policies in Phase 5A.

Media rows are resolved server-side via service-role only.
Do not add broad anon SELECT — recipient views resolve one photo at a time.
*/
ALTER TABLE digital_card_media ENABLE ROW LEVEL SECURITY;
