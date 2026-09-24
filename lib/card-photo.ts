export const CARD_PHOTOS_BUCKET = 'card-photos';

/** Max size for the original user-selected file (before client compression). */
export const CARD_PHOTO_MAX_BYTES = 20 * 1024 * 1024;

/** Soft target for client-optimised uploads (stop early when reached). */
export const CARD_PHOTO_TARGET_BYTES = 800 * 1024;

/** Hard cap for every image written to Supabase Storage. */
export const CARD_PHOTO_PROCESSED_MAX_BYTES = Math.round(1.5 * 1024 * 1024);

export const CARD_PHOTO_ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export type CardPhotoMimeType = (typeof CARD_PHOTO_ALLOWED_MIME_TYPES)[number];

export const CARD_PHOTO_SIGNED_URL_TTL_SECONDS = 600;

export const CARD_PHOTO_CUSTOMER_HINT =
  "Choose a photo from your device. We'll optimise it automatically.";

export function normalizeStoragePath(cardId: string): string {
  return `cards/${cardId}/photo.webp`;
}

/** Individual reusable media — one asset may be shared by many recipients on the same card. */
export function normalizeIndividualMediaStoragePath(
  digitalCardId: string,
  mediaId: string,
  mimeType: string
): string {
  return `cards/${digitalCardId}/media/${mediaId}.${mimeTypeToExtension(mimeType)}`;
}

export function mimeTypeToExtension(mimeType: string): string {
  switch (mimeType) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    default:
      throw new Error('Unsupported image type.');
  }
}

export function hasRecipientPhoto(recipient: {
  photo_media_id?: string | null;
  photo_path?: string | null;
  photo_uploaded_at?: string | null;
}): boolean {
  return Boolean(recipient.photo_media_id || recipient.photo_path || recipient.photo_uploaded_at);
}

export function hasCardPhoto(card: { photo_path?: string | null; photo_uploaded_at?: string | null }): boolean {
  return Boolean(card.photo_path || card.photo_uploaded_at);
}

function normalizeClientMime(type: string | undefined | null): string {
  return (type ?? '').trim().toLowerCase();
}

/**
 * Client-side gate before decode/compress.
 * Does not trust extensions alone; empty MIME (common on iOS) is allowed through
 * so decode + server magic-byte checks can decide.
 */
export function validateImageFile(
  file: File | { type: string; size: number; name?: string }
): { valid: true } | { valid: false; error: string } {
  if (!file) {
    return { valid: false, error: 'Please choose a photo to continue.' };
  }

  if (!file.size || file.size <= 0) {
    return { valid: false, error: 'That file looks empty. Please choose another photo.' };
  }

  if (file.size > CARD_PHOTO_MAX_BYTES) {
    return {
      valid: false,
      error: 'That photo is too large. Please choose a smaller one and try again.',
    };
  }

  const mime = normalizeClientMime(file.type);

  // Block obvious non-raster types early.
  if (mime === 'image/svg+xml' || mime === 'image/svg') {
    return {
      valid: false,
      error: "That file can't be used as a photo. Please choose a different image.",
    };
  }

  if (mime && !mime.startsWith('image/')) {
    return {
      valid: false,
      error: "That file can't be used as a photo. Please choose a different image.",
    };
  }

  return { valid: true };
}

export function validateImageBuffer(
  mimeType: string,
  sizeBytes: number
): { valid: true } | { valid: false; error: string } {
  if (!CARD_PHOTO_ALLOWED_MIME_TYPES.includes(mimeType as CardPhotoMimeType)) {
    return { valid: false, error: "That file can't be used as a photo. Please choose a different image." };
  }

  if (sizeBytes > CARD_PHOTO_MAX_BYTES) {
    return {
      valid: false,
      error: 'That photo is too large. Please choose a smaller one and try again.',
    };
  }

  return { valid: true };
}

/** Validate a client-optimised payload that will be stored in Supabase. */
export function validateProcessedImageBuffer(
  mimeType: string,
  sizeBytes: number
): { valid: true } | { valid: false; error: string } {
  if (!CARD_PHOTO_ALLOWED_MIME_TYPES.includes(mimeType as CardPhotoMimeType)) {
    return { valid: false, error: "We couldn't save this photo. Please try another image." };
  }

  if (sizeBytes > CARD_PHOTO_PROCESSED_MAX_BYTES) {
    return { valid: false, error: "We couldn't prepare this photo. Please try another image." };
  }

  return { valid: true };
}
