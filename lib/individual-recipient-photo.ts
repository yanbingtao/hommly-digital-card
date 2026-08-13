import type { SupabaseClient } from '@supabase/supabase-js';
import {
  hasRecipientPhoto,
  normalizeIndividualMediaStoragePath,
  validateProcessedImageBuffer,
} from './card-photo';
import { assertAllowedImageBinary } from './image-signature';
import {
  createPhotoSignedUrl,
  deleteCardPhoto,
  logPhotoCleanupIssue,
} from './card-photo-storage';
import {
  assignPhotoMediaToRecipients,
  cleanupUnreferencedMediaIds,
  clearPhotoMediaFromRecipients,
  createDigitalCardPhotoMedia,
} from './digital-card-media';
import type { DigitalCardRecipient } from './types';

/** Final desired photo state for selected recipients (buyer-facing: enabled or not). */
export type IndividualFinalPhotoState =
  | { enabled: false }
  | {
      enabled: true;
      source: 'new_upload';
      buffer: ArrayBuffer | Buffer;
      mimeType: string;
      originalName?: string | null;
      sizeBytes: number;
    }
  | {
      enabled: true;
      source: 'existing_media';
      mediaId: string;
    };

export type IndividualPhotoPrefillKey = 'none' | `media:${string}` | `legacy:${string}`;

export function getRecipientPhotoPrefillKey(row: DigitalCardRecipient): IndividualPhotoPrefillKey {
  if (row.photo_media_id) {
    return `media:${row.photo_media_id}`;
  }
  if (row.photo_path) {
    return `legacy:${row.id}`;
  }
  return 'none';
}

export function buildPhotoPrefillState(
  recipients: DigitalCardRecipient[]
): { kind: 'value'; value: IndividualPhotoPrefillKey } | { kind: 'mixed' } {
  if (recipients.length === 0) {
    return { kind: 'value', value: 'none' };
  }
  const keys = recipients.map(getRecipientPhotoPrefillKey);
  const first = keys[0]!;
  for (const key of keys) {
    if (key !== first) {
      return { kind: 'mixed' };
    }
  }
  return { kind: 'value', value: first };
}

export function selectedRecipientsHavePhoto(recipients: DigitalCardRecipient[]): boolean {
  return recipients.some((row) => hasRecipientPhoto(row));
}

export function resolveSharedPreviewMediaId(recipients: DigitalCardRecipient[]): string | null {
  const prefill = buildPhotoPrefillState(recipients);
  if (prefill.kind !== 'value' || !prefill.value.startsWith('media:')) {
    return null;
  }
  return prefill.value.slice('media:'.length);
}

export function resolveLegacyPreviewRecipientId(recipients: DigitalCardRecipient[]): string | null {
  const prefill = buildPhotoPrefillState(recipients);
  if (prefill.kind !== 'value' || !prefill.value.startsWith('legacy:')) {
    return null;
  }
  return prefill.value.slice('legacy:'.length);
}

export function resolveSharedLegacyPhotoPath(recipients: DigitalCardRecipient[]): string | null {
  const withPhoto = recipients.filter((row) => row.photo_path);
  if (withPhoto.length === 0 || withPhoto.length !== recipients.length) {
    return null;
  }
  const first = withPhoto[0]!.photo_path!;
  return withPhoto.every((row) => row.photo_path === first) ? first : null;
}

async function uploadMediaBinary(
  storagePath: string,
  buffer: ArrayBuffer | Buffer,
  contentType: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = (await import('./supabase-admin')).getSupabaseAdmin();
  const { CARD_PHOTOS_BUCKET } = await import('./card-photo');
  const body = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer;

  const { error } = await admin.storage.from(CARD_PHOTOS_BUCKET).upload(storagePath, body, {
    upsert: false,
    contentType,
    cacheControl: '3600',
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

export async function createUploadedIndividualPhotoMedia(
  supabase: SupabaseClient,
  input: {
    digitalCardId: string;
    buffer: ArrayBuffer | Buffer;
    mimeType: string;
    originalName?: string | null;
    sizeBytes: number;
  }
): Promise<{ ok: true; mediaId: string; storagePath: string } | { ok: false; error: string }> {
  const validated = validateProcessedImageBuffer(input.mimeType, input.sizeBytes);
  if (!validated.valid) {
    return { ok: false, error: validated.error };
  }

  const signature = assertAllowedImageBinary(input.buffer, input.mimeType);
  if (!signature.ok) {
    return { ok: false, error: signature.error };
  }

  const mimeType = signature.mime;
  const mediaId = crypto.randomUUID();
  let storagePath: string;
  try {
    storagePath = normalizeIndividualMediaStoragePath(input.digitalCardId, mediaId, mimeType);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unsupported image type.';
    return { ok: false, error: message };
  }

  const uploadResult = await uploadMediaBinary(storagePath, input.buffer, mimeType);
  if (!uploadResult.ok) {
    return { ok: false, error: uploadResult.error };
  }

  const { media, error: createError } = await createDigitalCardPhotoMedia(supabase, {
    id: mediaId,
    digital_card_id: input.digitalCardId,
    storage_path: storagePath,
    original_name: input.originalName ?? null,
    mime_type: mimeType,
    size_bytes: input.sizeBytes,
  });

  if (createError || !media) {
    await deleteCardPhoto(storagePath);
    return { ok: false, error: createError ?? 'Failed to create media record.' };
  }

  return { ok: true, mediaId: media.id, storagePath };
}

async function deleteOrphanUploadedMedia(
  supabase: SupabaseClient,
  mediaId: string,
  storagePath: string
): Promise<void> {
  await deleteCardPhoto(storagePath);
  await supabase.from('digital_card_media').delete().eq('id', mediaId);
}

function collectLegacyPhotoPaths(recipients: DigitalCardRecipient[]): string[] {
  return Array.from(
    new Set(
      recipients
        .map((row) => row.photo_path)
        .filter((value): value is string => Boolean(value))
    )
  );
}

async function cleanupLegacyPhotoPaths(paths: string[]): Promise<string[]> {
  const warnings: string[] = [];
  for (const path of paths) {
    const result = await deleteCardPhoto(path);
    if (result && result.ok === false) {
      logPhotoCleanupIssue('legacy-path', { path: result.path, error: result.error });
      warnings.push(result.error);
    }
  }
  return warnings;
}

/**
 * Resolves existing shared media for selected recipients when buyer keeps photo enabled
 * without uploading a new file. Returns null when no shared existing photo can be assigned.
 */
export async function resolveExistingPhotoMediaForRecipients(
  supabase: SupabaseClient,
  input: {
    digitalCardId: string;
    recipients: DigitalCardRecipient[];
  }
): Promise<{ ok: true; mediaId: string } | { ok: false; error: string }> {
  const sharedMediaId = resolveSharedPreviewMediaId(input.recipients);
  if (sharedMediaId) {
    return { ok: true, mediaId: sharedMediaId };
  }

  const legacyPath = resolveSharedLegacyPhotoPath(input.recipients);
  if (!legacyPath) {
    return { ok: false, error: 'Please choose a photo before publishing.' };
  }

  const sample = input.recipients.find((row) => row.photo_path === legacyPath);
  if (!sample) {
    return { ok: false, error: 'Please choose a photo before publishing.' };
  }

  const mediaId = crypto.randomUUID();
  const { media, error } = await createDigitalCardPhotoMedia(supabase, {
    id: mediaId,
    digital_card_id: input.digitalCardId,
    storage_path: legacyPath,
    original_name: sample.photo_original_name ?? null,
    mime_type: sample.photo_mime_type ?? 'image/jpeg',
    size_bytes: sample.photo_size_bytes ?? 0,
  });

  if (error || !media) {
    return { ok: false, error: error ?? 'Failed to register existing photo.' };
  }

  return { ok: true, mediaId: media.id };
}

export type ApplyIndividualPhotoPublishResult =
  | {
      ok: true;
      cleanupWarning: string | null;
    }
  | {
      ok: false;
      error: string;
      orphanMediaCleaned?: boolean;
    };

/**
 * Photo publish ordering (after content publish succeeds):
 * - enabled false: clear selected photo_media_id → cleanup unreferenced media
 * - enabled true + new upload: assign uploaded media → cleanup unreferenced media + legacy paths
 * - enabled true + existing media: assign existing media id → cleanup unreferenced media + legacy paths
 */
export async function applyIndividualRecipientPhotoOnPublish(
  supabase: SupabaseClient,
  input: {
    digitalCardId: string;
    recipientIds: string[];
    photo: IndividualFinalPhotoState;
    recipientsBefore: DigitalCardRecipient[];
  }
): Promise<ApplyIndividualPhotoPublishResult> {
  const { photo, digitalCardId, recipientIds, recipientsBefore } = input;
  const selectedBefore = recipientsBefore.filter((row) => recipientIds.includes(row.id));

  if (!photo.enabled) {
    const clearResult = await clearPhotoMediaFromRecipients(supabase, {
      digitalCardId,
      recipientIds,
    });
    if (!clearResult.ok) {
      return { ok: false, error: clearResult.error };
    }

    const legacyPaths = collectLegacyPhotoPaths(selectedBefore);

    const { cleaned, errors } = await cleanupUnreferencedMediaIds(
      supabase,
      clearResult.previousMediaIds
    );
    const legacyWarnings = await cleanupLegacyPhotoPaths(legacyPaths);

    const cleanupWarning =
      errors.length > 0 || legacyWarnings.length > 0
        ? [...errors, ...legacyWarnings].join('; ')
        : null;

    if (cleanupWarning) {
      logPhotoCleanupIssue('clear-unreferenced', {
        digitalCardId,
        recipientIds,
        cleanupWarning,
      });
    }

    if (process.env.NODE_ENV !== 'production' && cleaned.length > 0) {
      console.info('[Individual photo publish] cleaned unreferenced media after clear', {
        count: cleaned.length,
      });
    }

    return { ok: true, cleanupWarning };
  }

  let mediaId: string;

  if (photo.source === 'new_upload') {
    const uploadResult = await createUploadedIndividualPhotoMedia(supabase, {
      digitalCardId,
      buffer: photo.buffer,
      mimeType: photo.mimeType,
      originalName: photo.originalName,
      sizeBytes: photo.sizeBytes,
    });

    if (!uploadResult.ok) {
      return { ok: false, error: uploadResult.error };
    }

    mediaId = uploadResult.mediaId;

    const assignResult = await assignPhotoMediaToRecipients(supabase, {
      digitalCardId,
      recipientIds,
      mediaId,
    });

    if (!assignResult.ok) {
      await deleteOrphanUploadedMedia(supabase, uploadResult.mediaId, uploadResult.storagePath);
      return { ok: false, error: assignResult.error, orphanMediaCleaned: true };
    }

    const legacyPaths = collectLegacyPhotoPaths(selectedBefore);

    const { cleaned, errors } = await cleanupUnreferencedMediaIds(
      supabase,
      assignResult.previousMediaIds
    );
    const legacyWarnings = await cleanupLegacyPhotoPaths(legacyPaths);

    const cleanupWarning =
      errors.length > 0 || legacyWarnings.length > 0
        ? [...errors, ...legacyWarnings].join('; ')
        : null;

    if (cleanupWarning) {
      logPhotoCleanupIssue('replace-unreferenced', {
        digitalCardId,
        recipientIds,
        cleanupWarning,
      });
    }

    if (process.env.NODE_ENV !== 'production') {
      console.info('[Individual photo publish] new upload success', {
        assigned: assignResult.updatedCount,
        cleanedMedia: cleaned.length,
      });
    }

    return { ok: true, cleanupWarning };
  }

  mediaId = photo.mediaId;

  const assignResult = await assignPhotoMediaToRecipients(supabase, {
    digitalCardId,
    recipientIds,
    mediaId,
  });

  if (!assignResult.ok) {
    return { ok: false, error: assignResult.error };
  }

  const legacyPaths = collectLegacyPhotoPaths(selectedBefore);

  const { cleaned, errors } = await cleanupUnreferencedMediaIds(
    supabase,
    assignResult.previousMediaIds
  );
  const legacyWarnings = await cleanupLegacyPhotoPaths(legacyPaths);

  const cleanupWarning =
    errors.length > 0 || legacyWarnings.length > 0
      ? [...errors, ...legacyWarnings].join('; ')
      : null;

  if (process.env.NODE_ENV !== 'production') {
    console.info('[Individual photo publish] existing media assign success', {
      assigned: assignResult.updatedCount,
      cleanedMedia: cleaned.length,
    });
  }

  return { ok: true, cleanupWarning };
}

export async function resolveIndividualRecipientPhotoPreviewUrl(
  supabase: SupabaseClient,
  input: {
    editToken: string;
    recipientIds: string[];
  }
): Promise<{ signedUrl: string | null; mixed: boolean; error: string | null }> {
  const { loadIndividualRecipientEditorCore } = await import('./publish-individual-recipients-core');
  const { getDigitalCardMediaById } = await import('./digital-card-media');
  const { resolveRecipientPhotoStoragePath } = await import('./digital-card-media');

  const loadResult = await loadIndividualRecipientEditorCore(supabase, {
    editToken: input.editToken,
    recipientIds: input.recipientIds,
  });

  if (!loadResult.ok) {
    return { signedUrl: null, mixed: false, error: loadResult.error };
  }

  const { getRecipientsForCard } = await import('./card-recipients');
  const { card } = await (async () => {
    const trimmed = input.editToken.trim();
    const { data } = await supabase
      .from('digital_cards')
      .select('id')
      .eq('edit_token', trimmed)
      .maybeSingle();
    return { card: data };
  })();

  if (!card?.id) {
    return { signedUrl: null, mixed: false, error: 'Gift order not found.' };
  }

  const { recipients } = await getRecipientsForCard(supabase, card.id as string);
  const selected = recipients.filter((row) => input.recipientIds.includes(row.id));

  const prefill = buildPhotoPrefillState(selected);
  if (prefill.kind === 'mixed') {
    return { signedUrl: null, mixed: true, error: null };
  }

  if (prefill.value === 'none') {
    return { signedUrl: null, mixed: false, error: null };
  }

  if (prefill.value.startsWith('media:')) {
    const mediaId = prefill.value.slice('media:'.length);
    const { media, error } = await getDigitalCardMediaById(supabase, mediaId);
    if (error || !media) {
      return { signedUrl: null, mixed: false, error: error ?? 'Photo not found.' };
    }
    const signedUrl = await createPhotoSignedUrl(media.storage_path);
    return { signedUrl, mixed: false, error: null };
  }

  const legacyRecipientId = prefill.value.slice('legacy:'.length);
  const legacyRecipient = selected.find((row) => row.id === legacyRecipientId);
  if (!legacyRecipient) {
    return { signedUrl: null, mixed: false, error: 'Photo not found.' };
  }

  const storagePath = resolveRecipientPhotoStoragePath(legacyRecipient, null);
  if (!storagePath) {
    return { signedUrl: null, mixed: false, error: null };
  }

  const signedUrl = await createPhotoSignedUrl(storagePath);
  return { signedUrl, mixed: false, error: null };
}
