import { addMonths } from 'date-fns';
import {
  CARD_CLEANUP_BUFFER_MONTHS,
  CARD_HARD_DELETE_MONTHS,
  isCardEligibleForHardDelete,
  type CardExpiryFields,
} from './card-expiry';
import {
  cleanupUnreferencedMediaIds,
  listDigitalCardMediaForCard,
} from './digital-card-media';
import { deleteCardPhoto, logPhotoCleanupIssue } from './card-photo-storage';
import { getSupabaseAdmin } from './supabase-admin';
import type { DigitalCardMedia } from './types';

export const ORPHAN_MEDIA_SAFE_AGE_MS = 24 * 60 * 60 * 1000;

/** Bound per cron/admin invocation to stay within serverless limits. */
export const CLEANUP_CARD_BATCH_SIZE = 50;
export const CLEANUP_MAX_BATCHES_PER_RUN = 20;

export type PhotoCleanupResult = {
  scanned: number;
  /** @deprecated Prefer expiredCardsDeleted — kept for cron/admin backward compat. */
  cleaned: number;
  expiredCardsDeleted: number;
  recipientsDeleted: number;
  mediaRowsDeleted: number;
  storageFilesDeleted: number;
  legacyPathsDeleted: number;
  orphanMediaCleaned: number;
  warnings: string[];
  errors: string[];
};

type CleanupCardRow = CardExpiryFields & {
  id: string;
  order_id: string;
  card_mode: string | null;
  photo_path: string | null;
};

function emptyResult(): PhotoCleanupResult {
  return {
    scanned: 0,
    cleaned: 0,
    expiredCardsDeleted: 0,
    recipientsDeleted: 0,
    mediaRowsDeleted: 0,
    storageFilesDeleted: 0,
    legacyPathsDeleted: 0,
    orphanMediaCleaned: 0,
    warnings: [],
    errors: [],
  };
}

const CLEANUP_CARD_SELECT =
  'id, order_id, card_mode, photo_path, status, created_at, first_published_at, published_at, expires_at_override, order:orders!inner(id, created_at, ordered_at)';

type OrderEmbed = { id: string; created_at: string; ordered_at?: string | null };

function flattenOrderCardRows(
  rows: Array<{
    id: string;
    created_at: string;
    ordered_at?: string | null;
    digital_cards: CleanupCardRow[] | CleanupCardRow | null;
  }>
): CleanupCardRow[] {
  const cards: CleanupCardRow[] = [];
  for (const row of rows) {
    const order: OrderEmbed = {
      id: row.id,
      created_at: row.created_at,
      ordered_at: row.ordered_at ?? row.created_at,
    };
    const nested = row.digital_cards;
    const list = Array.isArray(nested) ? nested : nested ? [nested] : [];
    for (const card of list) {
      cards.push({ ...card, order });
    }
  }
  return cards;
}

async function fetchOrderAgeCandidates(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  now: Date,
  offset: number
): Promise<{ cards: CleanupCardRow[]; orderCount: number; error: string | null }> {
  const lifecycleCutoff = addMonths(now, -CARD_HARD_DELETE_MONTHS).toISOString();
  const { data, error } = await supabase
    .from('orders')
    .select(
      `
      id, created_at, ordered_at,
      digital_cards (
        id, order_id, card_mode, photo_path, status, created_at, first_published_at, published_at, expires_at_override
      )
    `
    )
    .or(`ordered_at.lt.${lifecycleCutoff},created_at.lt.${lifecycleCutoff}`)
    .order('created_at', { ascending: true })
    .range(offset, offset + CLEANUP_CARD_BATCH_SIZE - 1);

  if (error) {
    return { cards: [], orderCount: 0, error: error.message };
  }

  const rows = (data ?? []) as Array<{
    id: string;
    created_at: string;
    ordered_at?: string | null;
    digital_cards: CleanupCardRow[] | CleanupCardRow | null;
  }>;

  return {
    cards: flattenOrderCardRows(rows),
    orderCount: rows.length,
    error: null,
  };
}

async function fetchOverrideBufferCandidates(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  now: Date
): Promise<{ cards: CleanupCardRow[]; error: string | null }> {
  const overrideCutoff = addMonths(now, -CARD_CLEANUP_BUFFER_MONTHS).toISOString();
  const { data, error } = await supabase
    .from('digital_cards')
    .select(CLEANUP_CARD_SELECT)
    .not('expires_at_override', 'is', null)
    .lt('expires_at_override', overrideCutoff)
    .limit(CLEANUP_CARD_BATCH_SIZE);

  if (error) {
    return { cards: [], error: error.message };
  }

  return { cards: (data ?? []) as CleanupCardRow[], error: null };
}

async function collectRecipientLegacyPaths(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  digitalCardId: string
): Promise<{ paths: string[]; recipientCount: number; errors: string[] }> {
  const { data, error } = await supabase
    .from('digital_card_recipients')
    .select('id, photo_path')
    .eq('digital_card_id', digitalCardId);

  if (error) {
    return { paths: [], recipientCount: 0, errors: [error.message] };
  }

  const rows = data ?? [];
  const paths = Array.from(
    new Set(
      rows
        .map((row) => row.photo_path as string | null)
        .filter((value): value is string => Boolean(value))
    )
  );

  return { paths, recipientCount: rows.length, errors: [] };
}

async function deleteStoragePaths(
  paths: string[]
): Promise<{ deleted: number; errors: string[] }> {
  let deleted = 0;
  const errors: string[] = [];

  for (const path of paths) {
    const result = await deleteCardPhoto(path);
    if (!result.ok) {
      errors.push(`${path}: ${result.error}`);
      continue;
    }
    if (!result.alreadyMissing) {
      deleted += 1;
    } else {
      // Count idempotent missing deletes as cleaned for ops visibility.
      deleted += 1;
    }
  }

  return { deleted, errors };
}

/**
 * Hard-delete one eligible card and its order-scoped personalized data.
 *
 * Order:
 * 1. Collect media + legacy storage paths + recipient count
 * 2. Delete Storage objects (retryable if this fails — DB kept)
 * 3. Delete parent order → CASCADE digital_cards → recipients + media rows
 *    (messages, themes, sender_links, view/edit PIN fields included on those rows)
 *
 * edit_pin_rate_limits are keyed by sha256(cardId|ip) with no FK; orphan counters
 * may remain but contain no PIN/content.
 */
async function hardDeleteEligibleCard(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  card: CleanupCardRow
): Promise<{
  recipientsDeleted: number;
  mediaRowsDeleted: number;
  storageFilesDeleted: number;
  legacyPathsDeleted: number;
  warnings: string[];
  fatalError?: string;
}> {
  const warnings: string[] = [];

  const { media, error: mediaListError } = await listDigitalCardMediaForCard(supabase, card.id);
  if (mediaListError) {
    warnings.push(mediaListError);
  }

  const mediaPaths = media.map((row) => row.storage_path);
  const legacy = await collectRecipientLegacyPaths(supabase, card.id);
  if (legacy.errors.length > 0) {
    warnings.push(...legacy.errors);
  }

  const storagePaths = Array.from(
    new Set(
      [card.photo_path, ...mediaPaths, ...legacy.paths].filter(
        (value): value is string => Boolean(value)
      )
    )
  );

  const storage = await deleteStoragePaths(storagePaths);
  if (storage.errors.length > 0) {
    warnings.push(...storage.errors);
    logPhotoCleanupIssue('hard-delete-storage', {
      cardId: card.id,
      errors: storage.errors,
    });
    // Prefer retryability: do not delete DB rows if Storage cleanup failed.
    return {
      recipientsDeleted: 0,
      mediaRowsDeleted: 0,
      storageFilesDeleted: storage.deleted,
      legacyPathsDeleted: 0,
      warnings,
      fatalError: `Storage cleanup incomplete (${storage.errors.length} failure(s))`,
    };
  }

  const legacyDeleted = legacy.paths.length;

  const { error: deleteError } = await supabase.from('orders').delete().eq('id', card.order_id);

  if (deleteError) {
    return {
      recipientsDeleted: 0,
      mediaRowsDeleted: 0,
      storageFilesDeleted: storage.deleted,
      legacyPathsDeleted: legacyDeleted,
      warnings,
      fatalError: deleteError.message,
    };
  }

  return {
    recipientsDeleted: legacy.recipientCount,
    mediaRowsDeleted: media.length,
    storageFilesDeleted: storage.deleted,
    legacyPathsDeleted: legacyDeleted,
    warnings,
  };
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

/**
 * Full lifecycle cleanup: hard-delete cards past the 7-month policy (+ override buffer),
 * then run the existing 24h orphan media sweep.
 *
 * Shared by Admin manual action and `/api/internal/photo-cleanup` cron.
 */
async function processCleanupCards(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  cards: CleanupCardRow[],
  nowMs: number,
  result: PhotoCleanupResult
): Promise<number> {
  let deletedCount = 0;
  const seen = new Set<string>();

  for (const card of cards) {
    if (seen.has(card.id)) continue;
    seen.add(card.id);
    result.scanned += 1;

    if (!isCardEligibleForHardDelete(card, nowMs)) {
      continue;
    }

    try {
      const deleted = await hardDeleteEligibleCard(supabase, card);
      result.warnings.push(...deleted.warnings.map((message) => `Card ${card.id}: ${message}`));

      if (deleted.fatalError) {
        result.errors.push(`Card ${card.id}: ${deleted.fatalError}`);
        result.storageFilesDeleted += deleted.storageFilesDeleted;
        logPhotoCleanupIssue('hard-delete-card', {
          cardId: card.id,
          error: deleted.fatalError,
        });
        continue;
      }

      result.expiredCardsDeleted += 1;
      result.cleaned += 1;
      deletedCount += 1;
      result.recipientsDeleted += deleted.recipientsDeleted;
      result.mediaRowsDeleted += deleted.mediaRowsDeleted;
      result.storageFilesDeleted += deleted.storageFilesDeleted;
      result.legacyPathsDeleted += deleted.legacyPathsDeleted;

      console.info('[cleanupExpiredCardsAndPhotos] deleted card', {
        cardId: card.id,
        recipientsDeleted: deleted.recipientsDeleted,
        mediaRowsDeleted: deleted.mediaRowsDeleted,
        storageFilesDeleted: deleted.storageFilesDeleted,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown cleanup error';
      result.errors.push(`Card ${card.id}: ${message}`);
      logPhotoCleanupIssue('hard-delete-card', { cardId: card.id, error: message });
    }
  }

  return deletedCount;
}

/**
 * Full lifecycle cleanup: hard-delete cards past order-date + 7 months
 * (or effective admin expiry + 1 month), then run the 24h orphan media sweep.
 *
 * Shared by Admin manual action and `/api/internal/photo-cleanup` cron.
 */
export async function cleanupExpiredCardsAndPhotos(): Promise<PhotoCleanupResult> {
  const supabase = getSupabaseAdmin();
  const result = emptyResult();
  const now = new Date();

  let offset = 0;

  for (let batch = 0; batch < CLEANUP_MAX_BATCHES_PER_RUN; batch += 1) {
    const { cards, orderCount, error } = await fetchOrderAgeCandidates(supabase, now, offset);
    if (error) {
      result.errors.push(error);
      break;
    }
    if (orderCount === 0) break;

    const deletedInBatch = await processCleanupCards(supabase, cards, now.getTime(), result);

    if (deletedInBatch > 0) {
      continue;
    }

    offset += orderCount;
    if (orderCount < CLEANUP_CARD_BATCH_SIZE) break;
  }

  // Catch admin-override cards whose order is still "young" but override buffer elapsed.
  const overrideBatch = await fetchOverrideBufferCandidates(supabase, now);
  if (overrideBatch.error) {
    result.errors.push(overrideBatch.error);
  } else if (overrideBatch.cards.length > 0) {
    await processCleanupCards(supabase, overrideBatch.cards, now.getTime(), result);
  }

  const orphanResult = await cleanupOrphanDigitalCardMedia();
  result.orphanMediaCleaned += orphanResult.cleaned;
  result.warnings.push(...orphanResult.warnings);
  result.errors.push(...orphanResult.errors);

  console.info('[cleanupExpiredCardsAndPhotos]', {
    scanned: result.scanned,
    expiredCardsDeleted: result.expiredCardsDeleted,
    recipientsDeleted: result.recipientsDeleted,
    mediaRowsDeleted: result.mediaRowsDeleted,
    storageFilesDeleted: result.storageFilesDeleted,
    legacyPathsDeleted: result.legacyPathsDeleted,
    orphanMediaCleaned: result.orphanMediaCleaned,
    warnings: result.warnings.length,
    errors: result.errors.length,
  });

  return result;
}

/** @deprecated Alias — prefer cleanupExpiredCardsAndPhotos. */
export async function cleanupExpiredCardPhotos(): Promise<PhotoCleanupResult> {
  return cleanupExpiredCardsAndPhotos();
}

/** Kept for diagnostics / future Storage listing sweeps. */
export async function listMediaRowsForCard(digitalCardId: string) {
  const supabase = getSupabaseAdmin();
  return listDigitalCardMediaForCard(supabase, digitalCardId);
}
