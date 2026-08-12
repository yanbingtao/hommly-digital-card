import { getEffectiveExpiry, isCardExpired } from './card-expiry';
import { deleteAllDigitalCardMediaForCard } from './digital-card-media';
import { deleteCardPhoto, clearCardPhotoMetadata } from './card-photo-storage';
import { getSupabase } from './supabase';
import { CardWithOrder } from './types';

export type PhotoCleanupResult = {
  scanned: number;
  cleaned: number;
  errors: string[];
};

export async function cleanupExpiredCardPhotos(): Promise<PhotoCleanupResult> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('digital_cards')
    .select(
      'id, card_mode, photo_path, photo_original_name, photo_mime_type, photo_size_bytes, photo_uploaded_at, status, first_published_at, published_at, expires_at_override'
    )
    .or('photo_path.not.is.null,card_mode.eq.individual');

  if (error) {
    return { scanned: 0, cleaned: 0, errors: [error.message] };
  }

  const cards = (data ?? []) as CardWithOrder[];
  const errors: string[] = [];
  let cleaned = 0;

  for (const card of cards) {
    const effectiveExpiry = getEffectiveExpiry(card);
    const shouldClean =
      isCardExpired(card) || (effectiveExpiry !== null && Date.now() > effectiveExpiry.getTime());

    if (!shouldClean) continue;

    try {
      if (card.card_mode === 'individual') {
        const mediaResult = await deleteAllDigitalCardMediaForCard(supabase, card.id);
        if (mediaResult.errors.length > 0) {
          errors.push(...mediaResult.errors.map((message) => `Card ${card.id}: ${message}`));
        }
        if (mediaResult.deletedRows > 0 || mediaResult.deletedPaths.length > 0) {
          cleaned += 1;
        }
        continue;
      }

      if (!card.photo_path) continue;

      await deleteCardPhoto(card.photo_path);
      await clearCardPhotoMetadata(supabase, card.id);
      cleaned += 1;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown cleanup error';
      errors.push(`Card ${card.id}: ${message}`);
    }
  }

  console.info(
    `[cleanupExpiredCardPhotos] scanned=${cards.length} cleaned=${cleaned} errors=${errors.length}`
  );

  return { scanned: cards.length, cleaned, errors };
}
