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
