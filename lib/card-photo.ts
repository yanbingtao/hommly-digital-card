export const CARD_PHOTOS_BUCKET = 'card-photos';

export const CARD_PHOTO_MAX_BYTES = 5 * 1024 * 1024;

export const CARD_PHOTO_ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export type CardPhotoMimeType = (typeof CARD_PHOTO_ALLOWED_MIME_TYPES)[number];

export const CARD_PHOTO_SIGNED_URL_TTL_SECONDS = 600;

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

export function validateImageFile(
  file: File | { type: string; size: number; name?: string }
): { valid: true } | { valid: false; error: string } {
  if (!file) {
    return { valid: false, error: 'No file provided.' };
  }

  if (!CARD_PHOTO_ALLOWED_MIME_TYPES.includes(file.type as CardPhotoMimeType)) {
    return { valid: false, error: 'Please upload a JPG, PNG, or WebP image.' };
  }

  if (file.size > CARD_PHOTO_MAX_BYTES) {
    return { valid: false, error: 'Image must be 5MB or smaller.' };
  }

  return { valid: true };
}

export function validateImageBuffer(
  mimeType: string,
  sizeBytes: number
): { valid: true } | { valid: false; error: string } {
  if (!CARD_PHOTO_ALLOWED_MIME_TYPES.includes(mimeType as CardPhotoMimeType)) {
    return { valid: false, error: 'Unsupported image type.' };
  }

  if (sizeBytes > CARD_PHOTO_MAX_BYTES) {
    return { valid: false, error: 'Image must be 5MB or smaller.' };
  }

  return { valid: true };
}
