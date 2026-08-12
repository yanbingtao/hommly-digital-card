import { isCardExpired } from './card-expiry';
import { hasCardPhoto } from './card-photo';
import { isValidPublicToken } from './card-availability';
import { getSupabase } from './supabase';
import { getSupabaseAdmin } from './supabase-admin';
import {
  getRecipientViewPhotoSource,
  getRecipientViewPinSource,
  isResolvedRecipientViewAvailable,
  resolveRecipientViewToken,
  type ResolvedRecipientView,
} from './recipient-view-resolver';
import { CardWithOrder } from './types';
import { verifyViewPin } from './view-pin-crypto';
import { isValidViewPin } from './view-pin';

export async function findPublishedViewForPhoto(
  viewToken: string
): Promise<{ resolved: ResolvedRecipientView | null; error: string | null }> {
  if (!isValidPublicToken(viewToken)) {
    return { resolved: null, error: 'Invalid card link.' };
  }

  const supabase = getSupabaseAdmin();
  const result = await resolveRecipientViewToken(supabase, viewToken);

  if (!result.ok) {
    return { resolved: null, error: 'Card not available.' };
  }

  if (!isResolvedRecipientViewAvailable(result.resolved)) {
    return { resolved: null, error: 'Card not available.' };
  }

  return { resolved: result.resolved, error: null };
}

/** @deprecated Prefer findPublishedViewForPhoto for mode-aware resolution. */
export async function findPublishedCardByPublicToken(
  publicToken: string
): Promise<{ card: CardWithOrder | null; error: string | null }> {
  const { resolved, error } = await findPublishedViewForPhoto(publicToken);
  if (error || !resolved) {
    return { card: null, error: error ?? 'Card not available.' };
  }
  if (resolved.mode !== 'shared') {
    return { card: null, error: 'Card not available.' };
  }
  return { card: resolved.card, error: null };
}

export async function verifyViewerPinForResolved(
  resolved: ResolvedRecipientView,
  pin?: string | null
): Promise<{ allowed: boolean; error: string | null }> {
  const source = getRecipientViewPinSource(resolved);

  if (!source.view_pin_enabled) {
    return { allowed: true, error: null };
  }

  if (!pin || !isValidViewPin(pin)) {
    return { allowed: false, error: 'PIN required.' };
  }

  if (!source.view_pin_hash) {
    return { allowed: true, error: null };
  }

  return {
    allowed: verifyViewPin(pin, source.view_pin_hash),
    error: null,
  };
}

export async function verifyViewerPinIfRequired(
  resolved: ResolvedRecipientView,
  pin?: string | null
): Promise<{ allowed: boolean; error: string | null }> {
  return verifyViewerPinForResolved(resolved, pin);
}

export function getPhotoPathForResolvedView(resolved: ResolvedRecipientView): string | null {
  const source = getRecipientViewPhotoSource(resolved);
  return hasCardPhoto(source) ? source.photo_path : null;
}

export async function findCardByEditToken(
  editToken: string
): Promise<{ card: CardWithOrder | null; error: string | null }> {
  if (!editToken?.trim()) {
    return { card: null, error: 'Invalid edit token.' };
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('digital_cards')
    .select('*, order:orders(*)')
    .eq('edit_token', editToken)
    .maybeSingle();

  if (error) {
    return { card: null, error: error.message };
  }

  if (!data) {
    return { card: null, error: 'Card not found.' };
  }

  return { card: data as CardWithOrder, error: null };
}

export function assertCardEditable(card: CardWithOrder): string | null {
  if (card.status === 'disabled' || card.status === 'expired') {
    return 'This card is no longer available for editing.';
  }

  if (isCardExpired(card)) {
    return 'This card has expired. Photo changes are disabled until Hommly reactivates it.';
  }

  return null;
}
