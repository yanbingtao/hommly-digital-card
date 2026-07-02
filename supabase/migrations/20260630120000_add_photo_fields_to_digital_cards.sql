-- Photo metadata for private Supabase Storage uploads (card-photos bucket).
ALTER TABLE digital_cards
  ADD COLUMN IF NOT EXISTS photo_path text,
  ADD COLUMN IF NOT EXISTS photo_original_name text,
  ADD COLUMN IF NOT EXISTS photo_mime_type text,
  ADD COLUMN IF NOT EXISTS photo_size_bytes integer,
  ADD COLUMN IF NOT EXISTS photo_uploaded_at timestamptz;

-- Private bucket for card photos (create in dashboard if this insert is not permitted).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'card-photos',
  'card-photos',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
