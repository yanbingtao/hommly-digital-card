import { getEffectiveExpiry, isCardExpired } from './card-expiry';
import {
  cleanupUnreferencedMediaIds,
  deleteAllDigitalCardMediaForCard,
  listDigitalCardMediaForCard,
} from './digital-card-media';
import { deleteCardPhoto, clearCardPhotoMetadata, logPhotoCleanupIssue } from './card-photo-storage';
import { getSupabaseAdmin } from './supabase-admin';
import type { CardWithOrder, DigitalCardMedia } from './types';

export const ORPHAN_MEDIA_SAFE_AGE_MS = 24 * 60 * 60 * 1000;

export type PhotoCleanupResult = {
  scanned: number;
  cleaned: number;
  mediaRowsDeleted: number;
  storageFilesDeleted: number;
  legacyPathsDeleted: number;
  orphanMediaCleaned: number;
  warnings: string[];
  errors: string[];
};

function emptyResult(): PhotoCleanupResult {
  return {
    scanned: 0,
    cleaned: 0,
    mediaRowsDeleted: 0,
    storageFilesDeleted: 0,
    legacyPathsDeleted: 0,
    orphanMediaCleaned: 0,
    warnings: [],
    errors: [],
  };
}

async function cleanupLegacyRecipientPhotoPaths(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  digitalCardId: string
): Promise<{ deleted: number; errors: string[] }> {
  const { data, error } = await supabase
    .from('digital_card_recipients')
    .select('id, photo_path')
    .eq('digital_card_id', digitalCardId)
    .not('photo_path', 'is', null);

  if (error) {
    return { deleted: 0, errors: [error.message] };
  }

  const paths = Array.from(
    new Set(
      (data ?? [])
        .map((row) => row.photo_path as string | null)
        .filter((value): value is string => Boolean(value))
    )
  );

  let deleted = 0;
  const errors: string[] = [];

  for (const path of paths) {
    const result = await deleteCardPhoto(path);
    if (!result.ok) {
      errors.push(`${path}: ${result.error}`);
      continue;
    }
    deleted += 1;
  }

  if (paths.length > 0) {
    const { error: clearError } = await supabase
      .from('digital_card_recipients')
      .update({
        photo_path: null,
        photo_original_name: null,
        photo_mime_type: null,
        photo_size_bytes: null,
        photo_uploaded_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('digital_card_id', digitalCardId)
      .not('photo_path', 'is', null);

    if (clearError) {
      errors.push(clearError.message);
    }
  }

  return { deleted, errors };
}

export async function cleanupOrphanDigitalCardMedia(
  olderThanMs = ORPHAN_MEDIA_SAFE_AGE_MS
): Promise<{ cleaned: number; errors: string[]; warnings: string[] }> {
  // Service role required: digital_card_media / recipients have RLS with no anon policies.
  const supabase = getSupabaseAdmin();
  const cutoff = new Date(Date.now() - olderThanMs).toISOString();

  const { data, error } = await supabase
    .from('digital_card_media')
    .select('id, created_at, storage_path')
    .lt('created_at', cutoff)
    .limit(500);

  if (error) {
    return { cleaned: 0, errors: [error.message], warnings: [] };
  }

  const mediaRows = (data ?? []) as Pick<DigitalCardMedia, 'id' | 'created_at' | 'storage_path'>[];
  if (mediaRows.length === 0) {
    return { cleaned: 0, errors: [], warnings: [] };
  }

  const { cleaned, errors } = await cleanupUnreferencedMediaIds(
    supabase,
    mediaRows.map((row) => row.id)
  );

  if (errors.length > 0) {
    logPhotoCleanupIssue('orphan-media-sweep', { errors });
  }

  return {
    cleaned: cleaned.length,
    errors: [],
    warnings: errors,
  };
}

export async function cleanupExpiredCardPhotos(): Promise<PhotoCleanupResult> {
  // Service role required for recipient/media rows and consistent Admin + Cron cleanup.
  const supabase = getSupabaseAdmin();
  const result = emptyResult();

  const { data, error } = await supabase
    .from('digital_cards')
    .select(
      'id, card_mode, photo_path, photo_original_name, photo_mime_type, photo_size_bytes, photo_uploaded_at, status, first_published_at, published_at, expires_at_override'
    )
    .or('photo_path.not.is.null,card_mode.eq.individual');

  if (error) {
    result.errors.push(error.message);
    return result;
  }

  const cards = (data ?? []) as CardWithOrder[];
  result.scanned = cards.length;

  for (const card of cards) {
    const effectiveExpiry = getEffectiveExpiry(card);
    const shouldClean =
      isCardExpired(card) || (effectiveExpiry !== null && Date.now() > effectiveExpiry.getTime());

    if (!shouldClean) continue;

    try {
      if (card.card_mode === 'individual') {
        const mediaResult = await deleteAllDigitalCardMediaForCard(supabase, card.id);
        result.mediaRowsDeleted += mediaResult.deletedRows;
        result.storageFilesDeleted += mediaResult.deletedPaths.length;
        if (mediaResult.errors.length > 0) {
          result.warnings.push(...mediaResult.errors.map((message) => `Card ${card.id}: ${message}`));
          logPhotoCleanupIssue('expired-individual-media', {
            cardId: card.id,
            errors: mediaResult.errors,
          });
        }

        const legacy = await cleanupLegacyRecipientPhotoPaths(supabase, card.id);
        result.legacyPathsDeleted += legacy.deleted;
        if (legacy.errors.length > 0) {
          result.warnings.push(...legacy.errors.map((message) => `Card ${card.id}: ${message}`));
          logPhotoCleanupIssue('expired-legacy-paths', {
            cardId: card.id,
            errors: legacy.errors,
          });
        }

        if (
          mediaResult.deletedRows > 0 ||
          mediaResult.deletedPaths.length > 0 ||
          legacy.deleted > 0
        ) {
          result.cleaned += 1;
        }
        continue;
      }

      if (!card.photo_path) continue;

      const deleteResult = await deleteCardPhoto(card.photo_path);
      if (deleteResult && deleteResult.ok === false) {
        result.warnings.push(`Card ${card.id}: ${deleteResult.error}`);
        logPhotoCleanupIssue('expired-shared-photo', {
          cardId: card.id,
          path: card.photo_path,
          error: deleteResult.error,
        });
      } else {
        result.storageFilesDeleted += 1;
      }

      await clearCardPhotoMetadata(supabase, card.id);
      result.cleaned += 1;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown cleanup error';
      result.errors.push(`Card ${card.id}: ${message}`);
      logPhotoCleanupIssue('expired-card', { cardId: card.id, error: message });
    }
  }

  const orphanResult = await cleanupOrphanDigitalCardMedia();
  result.orphanMediaCleaned += orphanResult.cleaned;
  result.warnings.push(...orphanResult.warnings);
  result.errors.push(...orphanResult.errors);

  console.info('[cleanupExpiredCardPhotos]', {
    scanned: result.scanned,
    cleaned: result.cleaned,
    mediaRowsDeleted: result.mediaRowsDeleted,
    storageFilesDeleted: result.storageFilesDeleted,
    legacyPathsDeleted: result.legacyPathsDeleted,
    orphanMediaCleaned: result.orphanMediaCleaned,
    warnings: result.warnings.length,
    errors: result.errors.length,
  });

  return result;
}

/** Kept for diagnostics / future Storage listing sweeps. */
export async function listMediaRowsForCard(digitalCardId: string) {
  const supabase = getSupabaseAdmin();
  return listDigitalCardMediaForCard(supabase, digitalCardId);
}
