import { getSupabaseAdmin } from './supabase-admin';
import {
  CARD_PHOTOS_BUCKET,
  CARD_PHOTO_SIGNED_URL_TTL_SECONDS,
  normalizeStoragePath,
} from './card-photo';

export async function deleteCardPhoto(photoPath: string | null | undefined): Promise<void> {
  if (!photoPath) return;

  const admin = getSupabaseAdmin();
  const { error } = await admin.storage.from(CARD_PHOTOS_BUCKET).remove([photoPath]);
  if (error) {
    console.error('[deleteCardPhoto] Storage error:', error.message);
  }
}

export async function uploadCardPhoto(
  cardId: string,
  fileBuffer: ArrayBuffer | Buffer,
  contentType: string
): Promise<string> {
  const path = normalizeStoragePath(cardId);
  const admin = getSupabaseAdmin();
  const body = fileBuffer instanceof ArrayBuffer ? new Uint8Array(fileBuffer) : fileBuffer;

  const { error } = await admin.storage.from(CARD_PHOTOS_BUCKET).upload(path, body, {
    upsert: true,
    contentType,
    cacheControl: '3600',
  });

  if (error) {
    throw new Error(error.message);
  }

  return path;
}

export async function createPhotoSignedUrl(
  photoPath: string,
  expiresInSeconds = CARD_PHOTO_SIGNED_URL_TTL_SECONDS
): Promise<string | null> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.storage
    .from(CARD_PHOTOS_BUCKET)
    .createSignedUrl(photoPath, expiresInSeconds);

  if (error || !data?.signedUrl) {
    console.error('[createPhotoSignedUrl] Error:', error?.message);
    return null;
  }

  return data.signedUrl;
}

export async function clearCardPhotoMetadata(
  supabase: ReturnType<typeof import('./supabase').getSupabase>,
  cardId: string
): Promise<void> {
  const { error } = await supabase
    .from('digital_cards')
    .update({
      photo_path: null,
      photo_original_name: null,
      photo_mime_type: null,
      photo_size_bytes: null,
      photo_uploaded_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', cardId);

  if (error) {
    throw new Error(error.message);
  }
}
