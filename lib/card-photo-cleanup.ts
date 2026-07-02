import { getEffectiveExpiry, isCardExpired } from './card-expiry';
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
      'id, photo_path, photo_original_name, photo_mime_type, photo_size_bytes, photo_uploaded_at, status, first_published_at, published_at, expires_at_override'
    )
    .not('photo_path', 'is', null);

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

    if (!shouldClean || !card.photo_path) continue;

    try {
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
