import { getSupabaseAdmin } from './supabase-admin';
import {
  CARD_PHOTOS_BUCKET,
  CARD_PHOTO_SIGNED_URL_TTL_SECONDS,
  normalizeStoragePath,
} from './card-photo';

export type StorageDeleteResult =
  | { ok: true; path: string; alreadyMissing?: boolean }
  | { ok: false; path: string; error: string };

export function logPhotoCleanupIssue(
  scope: string,
  details: Record<string, unknown>
): void {
  console.error(`[photo-cleanup:${scope}]`, details);
}

export async function deleteCardPhoto(
  photoPath: string | null | undefined
): Promise<StorageDeleteResult> {
  if (!photoPath) {
    return { ok: true, path: '', alreadyMissing: true };
  }

  const admin = getSupabaseAdmin();
  const { error } = await admin.storage.from(CARD_PHOTOS_BUCKET).remove([photoPath]);
  if (error) {
    const message = error.message || 'Storage delete failed';
    // Idempotent: missing objects are treated as cleaned.
    if (/not found|does not exist|No such file/i.test(message)) {
      return { ok: true, path: photoPath, alreadyMissing: true };
    }
    logPhotoCleanupIssue('deleteCardPhoto', { path: photoPath, error: message });
    return { ok: false, path: photoPath, error: message };
  }

  return { ok: true, path: photoPath };
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

/**
 * Upload shared-card photo to a temporary object first so a failed upload
 * cannot destroy the previous valid fixed-path photo.
 */
export async function uploadSharedCardPhotoCandidate(
  cardId: string,
  fileBuffer: ArrayBuffer | Buffer,
  contentType: string
): Promise<string> {
  const extension = contentType === 'image/png' ? 'png' : contentType === 'image/jpeg' ? 'jpg' : 'webp';
  const candidatePath = `cards/${cardId}/photo.next.${crypto.randomUUID()}.${extension}`;
  const admin = getSupabaseAdmin();
  const body = fileBuffer instanceof ArrayBuffer ? new Uint8Array(fileBuffer) : fileBuffer;

  const { error } = await admin.storage.from(CARD_PHOTOS_BUCKET).upload(candidatePath, body, {
    upsert: false,
    contentType,
    cacheControl: '3600',
  });

  if (error) {
    throw new Error(error.message);
  }

  return candidatePath;
}

export async function promoteSharedCardPhotoCandidate(
  cardId: string,
  candidatePath: string,
  contentType: string
): Promise<string> {
  const finalPath = normalizeStoragePath(cardId);
  const admin = getSupabaseAdmin();

  const { data: blob, error: downloadError } = await admin.storage
    .from(CARD_PHOTOS_BUCKET)
    .download(candidatePath);

  if (downloadError || !blob) {
    throw new Error(downloadError?.message ?? 'Failed to read uploaded photo.');
  }

  const buffer = await blob.arrayBuffer();
  const { error: uploadError } = await admin.storage.from(CARD_PHOTOS_BUCKET).upload(finalPath, new Uint8Array(buffer), {
    upsert: true,
    contentType,
    cacheControl: '3600',
  });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  // Best-effort cleanup of temporary candidate.
  await deleteCardPhoto(candidatePath);
  return finalPath;
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
