import { getSupabase } from './supabase';
import { isCardExpired } from './card-expiry';
import { isValidPublicToken } from './card-availability';
import { CardWithOrder } from './types';
import { verifyViewPin } from './view-pin-crypto';
import { isValidViewPin } from './view-pin';

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

export async function findPublishedCardByPublicToken(
  publicToken: string
): Promise<{ card: CardWithOrder | null; error: string | null }> {
  if (!isValidPublicToken(publicToken)) {
    return { card: null, error: 'Invalid card link.' };
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('digital_cards')
    .select('*, order:orders(*)')
    .eq('public_token', publicToken)
    .maybeSingle();

  if (error) {
    return { card: null, error: error.message };
  }

  if (!data || data.status !== 'published') {
    return { card: null, error: 'Card not available.' };
  }

  if (isCardExpired(data as CardWithOrder)) {
    return { card: null, error: 'Card has expired.' };
  }

  return { card: data as CardWithOrder, error: null };
}

export async function verifyViewerPinIfRequired(
  card: CardWithOrder,
  pin?: string | null
): Promise<{ allowed: boolean; error: string | null }> {
  if (!card.view_pin_enabled) {
    return { allowed: true, error: null };
  }

  if (!pin || !isValidViewPin(pin)) {
    return { allowed: false, error: 'PIN required.' };
  }

  if (!card.view_pin_hash) {
    return { allowed: true, error: null };
  }

  return {
    allowed: verifyViewPin(pin, card.view_pin_hash),
    error: null,
  };
}
