import type { SupabaseClient } from '@supabase/supabase-js';
import {
  CARD_PHOTOS_BUCKET,
  mimeTypeToExtension,
  normalizeIndividualMediaStoragePath,
  validateImageBuffer,
} from './card-photo';
import { deleteCardPhoto } from './card-photo-storage';
import type { DigitalCardMedia, DigitalCardRecipient } from './types';

export const DIGITAL_CARD_MEDIA_SELECT =
  'id, digital_card_id, storage_path, original_name, mime_type, size_bytes, media_type, created_at, updated_at';

export type CreateDigitalCardPhotoMediaInput = {
  id?: string;
  digital_card_id: string;
  storage_path: string;
  original_name?: string | null;
  mime_type: string;
  size_bytes: number;
};

export type AssignPhotoMediaInput = {
  digitalCardId: string;
  recipientIds: string[];
  mediaId: string;
};

export type ClearPhotoMediaInput = {
  digitalCardId: string;
  recipientIds: string[];
};

export type UploadIndividualPhotoMediaInput = {
  digitalCardId: string;
  buffer: ArrayBuffer | Buffer;
  mimeType: string;
  originalName?: string | null;
  sizeBytes: number;
  recipientIds: string[];
};

export function resolveRecipientPhotoStoragePath(
  recipient: Pick<DigitalCardRecipient, 'digital_card_id' | 'photo_media_id' | 'photo_path'>,
  media?: Pick<DigitalCardMedia, 'digital_card_id' | 'storage_path'> | null
): string | null {
  if (recipient.photo_media_id) {
    if (!media || media.digital_card_id !== recipient.digital_card_id) {
      return null;
    }
    return media.storage_path;
  }
  return recipient.photo_path ?? null;
}

export async function createDigitalCardPhotoMedia(
  supabase: SupabaseClient,
  input: CreateDigitalCardPhotoMediaInput
): Promise<{ media: DigitalCardMedia | null; error: string | null }> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('digital_card_media')
    .insert({
      ...(input.id ? { id: input.id } : {}),
      digital_card_id: input.digital_card_id,
      storage_path: input.storage_path,
      original_name: input.original_name ?? null,
      mime_type: input.mime_type,
      size_bytes: input.size_bytes,
      media_type: 'photo',
      created_at: now,
      updated_at: now,
    })
    .select(DIGITAL_CARD_MEDIA_SELECT)
    .single();

  if (error || !data) {
    return { media: null, error: error?.message ?? 'Failed to create media record.' };
  }

  return { media: data as DigitalCardMedia, error: null };
}

export async function getDigitalCardMediaById(
  supabase: SupabaseClient,
  mediaId: string
): Promise<{ media: DigitalCardMedia | null; error: string | null }> {
  const trimmed = mediaId?.trim();
  if (!trimmed) {
    return { media: null, error: 'Media id is required.' };
  }

  const { data, error } = await supabase
    .from('digital_card_media')
    .select(DIGITAL_CARD_MEDIA_SELECT)
    .eq('id', trimmed)
    .maybeSingle();

  if (error) {
    return { media: null, error: error.message };
  }

  return { media: (data as DigitalCardMedia | null) ?? null, error: null };
}

export async function listDigitalCardMediaForCard(
  supabase: SupabaseClient,
  digitalCardId: string
): Promise<{ media: DigitalCardMedia[]; error: string | null }> {
  const { data, error } = await supabase
    .from('digital_card_media')
    .select(DIGITAL_CARD_MEDIA_SELECT)
    .eq('digital_card_id', digitalCardId);

  if (error) {
    return { media: [], error: error.message };
  }

  return { media: (data ?? []) as DigitalCardMedia[], error: null };
}

export async function countRecipientMediaReferences(
  supabase: SupabaseClient,
  mediaId: string
): Promise<{ count: number; error: string | null }> {
  const { count, error } = await supabase
    .from('digital_card_recipients')
    .select('id', { count: 'exact', head: true })
    .eq('photo_media_id', mediaId);

  if (error) {
    return { count: 0, error: error.message };
  }

  return { count: count ?? 0, error: null };
}

async function uploadMediaBinary(
  storagePath: string,
  buffer: ArrayBuffer | Buffer,
  contentType: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = (await import('./supabase-admin')).getSupabaseAdmin();
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

export async function deleteDigitalCardMediaIfUnreferenced(
  supabase: SupabaseClient,
  mediaId: string
): Promise<{ deleted: boolean; error: string | null }> {
  const { count, error: countError } = await countRecipientMediaReferences(supabase, mediaId);
  if (countError) {
    return { deleted: false, error: countError };
  }

  if (count > 0) {
    return { deleted: false, error: null };
  }

  const { media, error: fetchError } = await getDigitalCardMediaById(supabase, mediaId);
  if (fetchError) {
    return { deleted: false, error: fetchError };
  }
  if (!media) {
    return { deleted: false, error: null };
  }

  await deleteCardPhoto(media.storage_path);

  const { error: deleteError } = await supabase.from('digital_card_media').delete().eq('id', mediaId);
  if (deleteError) {
    return { deleted: false, error: deleteError.message };
  }

  return { deleted: true, error: null };
}

export async function cleanupUnreferencedMediaIds(
  supabase: SupabaseClient,
  mediaIds: string[]
): Promise<{ cleaned: string[]; errors: string[] }> {
  const unique = Array.from(new Set(mediaIds.filter(Boolean)));
  const cleaned: string[] = [];
  const errors: string[] = [];

  for (const mediaId of unique) {
    const result = await deleteDigitalCardMediaIfUnreferenced(supabase, mediaId);
    if (result.error) {
      errors.push(`${mediaId}: ${result.error}`);
    } else if (result.deleted) {
      cleaned.push(mediaId);
    }
  }

  return { cleaned, errors };
}

function normalizeUniqueRecipientIds(recipientIds: string[]): string[] {
  return Array.from(new Set(recipientIds.map((id) => id.trim()).filter(Boolean)));
}

export async function assignPhotoMediaToRecipients(
  supabase: SupabaseClient,
  input: AssignPhotoMediaInput
): Promise<
  | { ok: true; updatedCount: number; previousMediaIds: string[] }
  | { ok: false; error: string }
> {
  const recipientIds = normalizeUniqueRecipientIds(input.recipientIds);
  const expectedCount = recipientIds.length;
  if (expectedCount === 0) {
    return { ok: false, error: 'Select at least one recipient.' };
  }

  const { media, error: mediaError } = await getDigitalCardMediaById(supabase, input.mediaId);
  if (mediaError || !media) {
    return { ok: false, error: mediaError ?? 'Media not found.' };
  }

  if (media.digital_card_id !== input.digitalCardId) {
    return { ok: false, error: 'Media does not belong to this card.' };
  }

  const { data: selectedRows, error: fetchError } = await supabase
    .from('digital_card_recipients')
    .select('id, digital_card_id, photo_media_id')
    .eq('digital_card_id', input.digitalCardId)
    .in('id', recipientIds);

  if (fetchError || !selectedRows || selectedRows.length !== expectedCount) {
    return { ok: false, error: 'One or more selected recipients could not be found.' };
  }

  const previousMediaIds = Array.from(
    new Set(
      (selectedRows as Pick<DigitalCardRecipient, 'id' | 'photo_media_id'>[])
        .map((row) => row.photo_media_id)
        .filter((value): value is string => Boolean(value))
    )
  );

  const now = new Date().toISOString();
  const { data: updatedRows, error: updateError } = await supabase
    .from('digital_card_recipients')
    .update({ photo_media_id: input.mediaId, updated_at: now })
    .eq('digital_card_id', input.digitalCardId)
    .in('id', recipientIds)
    .select('id');

  const actualCount = updatedRows?.length ?? 0;
  if (updateError || actualCount !== expectedCount) {
    return { ok: false, error: 'Failed to assign photo to selected recipients.' };
  }

  return { ok: true, updatedCount: actualCount, previousMediaIds };
}

export async function clearPhotoMediaFromRecipients(
  supabase: SupabaseClient,
  input: ClearPhotoMediaInput
): Promise<
  | { ok: true; updatedCount: number; previousMediaIds: string[] }
  | { ok: false; error: string }
> {
  const recipientIds = normalizeUniqueRecipientIds(input.recipientIds);
  const expectedCount = recipientIds.length;
  if (expectedCount === 0) {
    return { ok: false, error: 'Select at least one recipient.' };
  }

  const { data: selectedRows, error: fetchError } = await supabase
    .from('digital_card_recipients')
    .select('id, digital_card_id, photo_media_id')
    .eq('digital_card_id', input.digitalCardId)
    .in('id', recipientIds);

  if (fetchError || !selectedRows || selectedRows.length !== expectedCount) {
    return { ok: false, error: 'One or more selected recipients could not be found.' };
  }

  const previousMediaIds = Array.from(
    new Set(
      (selectedRows as Pick<DigitalCardRecipient, 'photo_media_id'>[])
        .map((row) => row.photo_media_id)
        .filter((value): value is string => Boolean(value))
    )
  );

  const now = new Date().toISOString();
  const { data: updatedRows, error: updateError } = await supabase
    .from('digital_card_recipients')
    .update({ photo_media_id: null, updated_at: now })
    .eq('digital_card_id', input.digitalCardId)
    .in('id', recipientIds)
    .select('id');

  const actualCount = updatedRows?.length ?? 0;
  if (updateError || actualCount !== expectedCount) {
    return { ok: false, error: 'Failed to clear photo from selected recipients.' };
  }

  return { ok: true, updatedCount: actualCount, previousMediaIds };
}

/**
 * Core upload lifecycle (no UI):
 * validate → upload binary → insert media → assign → cleanup unreferenced previous media.
 * On assignment failure after upload: remove orphaned media row + storage object.
 */
export async function uploadIndividualPhotoMediaCore(
  supabase: SupabaseClient,
  input: UploadIndividualPhotoMediaInput
): Promise<
  | { ok: true; mediaId: string; updatedCount: number; cleanedMediaIds: string[] }
  | { ok: false; error: string }
> {
  const validated = validateImageBuffer(input.mimeType, input.sizeBytes);
  if (!validated.valid) {
    return { ok: false, error: validated.error };
  }

  const recipientIds = normalizeUniqueRecipientIds(input.recipientIds);
  if (recipientIds.length === 0) {
    return { ok: false, error: 'Select at least one recipient.' };
  }

  const mediaId = crypto.randomUUID();
  let storagePath: string;
  try {
    storagePath = normalizeIndividualMediaStoragePath(input.digitalCardId, mediaId, input.mimeType);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unsupported image type.';
    return { ok: false, error: message };
  }

  const uploadResult = await uploadMediaBinary(storagePath, input.buffer, input.mimeType);
  if (!uploadResult.ok) {
    return { ok: false, error: uploadResult.error };
  }

  const { media, error: createError } = await createDigitalCardPhotoMedia(supabase, {
    id: mediaId,
    digital_card_id: input.digitalCardId,
    storage_path: storagePath,
    original_name: input.originalName ?? null,
    mime_type: input.mimeType,
    size_bytes: input.sizeBytes,
  });

  if (createError || !media) {
    await deleteCardPhoto(storagePath);
    return { ok: false, error: createError ?? 'Failed to create media record.' };
  }

  const assignResult = await assignPhotoMediaToRecipients(supabase, {
    digitalCardId: input.digitalCardId,
    recipientIds,
    mediaId: media.id,
  });

  if (!assignResult.ok) {
    await deleteCardPhoto(storagePath);
    await supabase.from('digital_card_media').delete().eq('id', media.id);
    return { ok: false, error: assignResult.error };
  }

  const { cleaned, errors } = await cleanupUnreferencedMediaIds(supabase, assignResult.previousMediaIds);
  if (errors.length > 0) {
    console.error('[uploadIndividualPhotoMediaCore] cleanup warnings:', errors.join('; '));
  }

  return {
    ok: true,
    mediaId: media.id,
    updatedCount: assignResult.updatedCount,
    cleanedMediaIds: cleaned,
  };
}

/** Deletes all storage objects for an Individual card's reusable media. DB rows cascade on parent delete. */
export async function deleteIndividualCardMediaStorage(
  supabase: SupabaseClient,
  digitalCardId: string
): Promise<{ deletedPaths: string[]; errors: string[] }> {
  const { media, error } = await listDigitalCardMediaForCard(supabase, digitalCardId);
  if (error) {
    return { deletedPaths: [], errors: [error] };
  }

  const deletedPaths: string[] = [];
  const errors: string[] = [];

  for (const row of media) {
    try {
      await deleteCardPhoto(row.storage_path);
      deletedPaths.push(row.storage_path);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown storage delete error';
      errors.push(`${row.storage_path}: ${message}`);
    }
  }

  return { deletedPaths, errors };
}

export async function deleteAllDigitalCardMediaForCard(
  supabase: SupabaseClient,
  digitalCardId: string
): Promise<{ deletedRows: number; deletedPaths: string[]; errors: string[] }> {
  const storageResult = await deleteIndividualCardMediaStorage(supabase, digitalCardId);

  const { data, error } = await supabase
    .from('digital_card_media')
    .delete()
    .eq('digital_card_id', digitalCardId)
    .select('id');

  if (error) {
    return {
      deletedRows: 0,
      deletedPaths: storageResult.deletedPaths,
      errors: [...storageResult.errors, error.message],
    };
  }

  return {
    deletedRows: data?.length ?? 0,
    deletedPaths: storageResult.deletedPaths,
    errors: storageResult.errors,
  };
}

/** Validates mime type maps to a supported extension without exposing storage paths. */
export function assertSupportedIndividualPhotoMimeType(mimeType: string): void {
  mimeTypeToExtension(mimeType);
}
