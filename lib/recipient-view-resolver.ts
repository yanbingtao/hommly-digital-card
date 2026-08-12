import type { SupabaseClient } from '@supabase/supabase-js';
import { isValidPublicToken, isRecipientCardUnavailable } from './card-availability';
import { getEffectiveExpiry, isCardExpired } from './card-expiry';
import type { CardWithOrder, DigitalCardRecipient } from './types';

const RECIPIENT_RESOLVER_SELECT =
  'id, digital_card_id, recipient_number, view_token, message, theme, animation, show_sender_links, sender_links, view_pin_enabled, view_pin_hash, photo_path, photo_original_name, photo_mime_type, photo_size_bytes, photo_uploaded_at, status, published_at, created_at, updated_at';

const PARENT_CARD_SELECT =
  'id, order_id, card_mode, platform, external_order_id, public_token, edit_token, message, theme, animation, status, show_sender_links, sender_links, view_pin_enabled, view_pin_hash, created_at, updated_at, published_at, first_published_at, expires_at_override, photo_path, photo_original_name, photo_mime_type, photo_size_bytes, photo_uploaded_at, order:orders(*)';

export type ResolvedRecipientView =
  | {
      mode: 'shared';
      card: CardWithOrder;
      recipient: null;
    }
  | {
      mode: 'individual';
      card: CardWithOrder;
      recipient: DigitalCardRecipient;
    };

export type ResolveRecipientViewFailureReason =
  | 'invalid_token'
  | 'not_found'
  | 'ambiguous_token'
  | 'unavailable';

export type ResolveRecipientViewResult =
  | { ok: true; resolved: ResolvedRecipientView }
  | { ok: false; reason: ResolveRecipientViewFailureReason };

export function isSharedRecipientViewAvailable(card: CardWithOrder): boolean {
  if (card.card_mode === 'individual') return false;
  if (card.status !== 'published') return false;
  return !isRecipientCardUnavailable(card);
}

export function isParentLifecycleExpired(card: CardWithOrder): boolean {
  const expiresAt = getEffectiveExpiry(card);
  if (!expiresAt) return false;
  return Date.now() >= expiresAt.getTime();
}

export function isIndividualRecipientViewAvailable(
  card: CardWithOrder,
  recipient: DigitalCardRecipient
): boolean {
  if (card.card_mode !== 'individual') return false;
  if (!card.order) return false;
  if (card.status === 'disabled' || card.status === 'expired') return false;
  if (isParentLifecycleExpired(card)) return false;
  if (recipient.status !== 'published') return false;
  return true;
}

export function isResolvedRecipientViewAvailable(resolved: ResolvedRecipientView): boolean {
  if (resolved.mode === 'shared') {
    return isSharedRecipientViewAvailable(resolved.card);
  }
  return isIndividualRecipientViewAvailable(resolved.card, resolved.recipient);
}

/**
 * Resolves a public view token to either a Shared card or an Individual recipient row.
 * Checks recipient view_token first, then digital_cards.public_token.
 * Server-only — uses service-role client because recipient RLS has no anon policies.
 */
export async function resolveRecipientViewToken(
  supabase: SupabaseClient,
  token: string
): Promise<ResolveRecipientViewResult> {
  const trimmed = token?.trim();
  if (!trimmed || !isValidPublicToken(trimmed)) {
    return { ok: false, reason: 'invalid_token' };
  }

  const [recipientResult, cardResult] = await Promise.all([
    supabase
      .from('digital_card_recipients')
      .select(RECIPIENT_RESOLVER_SELECT)
      .eq('view_token', trimmed)
      .maybeSingle(),
    supabase
      .from('digital_cards')
      .select(PARENT_CARD_SELECT)
      .eq('public_token', trimmed)
      .maybeSingle(),
  ]);

  if (recipientResult.error) {
    console.error('[resolveRecipientViewToken] recipient lookup error:', recipientResult.error.message);
    return { ok: false, reason: 'not_found' };
  }

  if (cardResult.error) {
    console.error('[resolveRecipientViewToken] card lookup error:', cardResult.error.message);
    return { ok: false, reason: 'not_found' };
  }

  const recipientRow = recipientResult.data as DigitalCardRecipient | null;
  const cardRow = cardResult.data as unknown as CardWithOrder | null;

  if (recipientRow && cardRow) {
    console.error('[resolveRecipientViewToken] ambiguous token exists in both tables');
    return { ok: false, reason: 'ambiguous_token' };
  }

  if (recipientRow) {
    const { data: parent, error: parentError } = await supabase
      .from('digital_cards')
      .select(PARENT_CARD_SELECT)
      .eq('id', recipientRow.digital_card_id)
      .maybeSingle();

    if (parentError || !parent) {
      return { ok: false, reason: 'not_found' };
    }

    const parentCard = parent as unknown as CardWithOrder;
    if (parentCard.card_mode !== 'individual') {
      return { ok: false, reason: 'unavailable' };
    }

    return {
      ok: true,
      resolved: {
        mode: 'individual',
        card: parentCard,
        recipient: recipientRow,
      },
    };
  }

  if (cardRow) {
    if (cardRow.card_mode === 'individual') {
      return { ok: false, reason: 'unavailable' };
    }

    return {
      ok: true,
      resolved: {
        mode: 'shared',
        card: cardRow,
        recipient: null,
      },
    };
  }

  return { ok: false, reason: 'not_found' };
}

export type RecipientViewPinSource = {
  view_pin_enabled: boolean;
  view_pin_hash: string | null;
};

export function getRecipientViewPinSource(resolved: ResolvedRecipientView): RecipientViewPinSource {
  if (resolved.mode === 'individual') {
    return {
      view_pin_enabled: Boolean(resolved.recipient.view_pin_enabled),
      view_pin_hash: resolved.recipient.view_pin_hash ?? null,
    };
  }
  return {
    view_pin_enabled: Boolean(resolved.card.view_pin_enabled),
    view_pin_hash: resolved.card.view_pin_hash ?? null,
  };
}

export type RecipientViewPhotoSource = {
  photo_path: string | null;
  photo_uploaded_at: string | null;
};

export function getRecipientViewPhotoSource(resolved: ResolvedRecipientView): RecipientViewPhotoSource {
  if (resolved.mode === 'individual') {
    return {
      photo_path: resolved.recipient.photo_path ?? null,
      photo_uploaded_at: resolved.recipient.photo_uploaded_at ?? null,
    };
  }
  return {
    photo_path: resolved.card.photo_path ?? null,
    photo_uploaded_at: resolved.card.photo_uploaded_at ?? null,
  };
}
