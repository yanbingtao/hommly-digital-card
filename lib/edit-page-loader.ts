import { format } from 'date-fns';
import { getRecipientsForCard } from './card-recipients';
import { getEffectiveExpiry } from './card-expiry';
import { isParentLifecycleExpired } from './recipient-view-resolver';
import {
  assertSafeManagerItems,
  sortRecipientsByNumber,
  toIndividualRecipientManagerItem,
  type IndividualRecipientManagerItem,
} from './individual-recipient-manager';
import { getSupabaseAdmin } from './supabase-admin';
import { getSupabase, getConnectionErrorMessage } from './supabase';
import type { CardWithOrder, DigitalCardRecipient } from './types';
import { ensureEditPinForCard } from './edit-pin-service';
import { hasValidEditPinSession } from './edit-pin-auth';

async function getCardByEditTokenForLoader(
  editToken: string
): Promise<{ card: CardWithOrder | null; error: string | null }> {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('digital_cards')
      .select('*, order:orders(*)')
      .eq('edit_token', editToken)
      .maybeSingle();

    if (error) {
      return { card: null, error: error.message };
    }

    return { card: (data as CardWithOrder | null) ?? null, error: null };
  } catch (err: unknown) {
    return { card: null, error: getConnectionErrorMessage(err) };
  }
}

export type EditPageExpiredContext = {
  kind: 'expired';
  expiredOn: string | null;
};

export type EditPageNotFoundContext = {
  kind: 'not_found';
};

export type EditPageNeedsPinContext = {
  kind: 'needs_edit_pin';
  editToken: string;
};

export type EditPageSharedContext = {
  kind: 'shared';
  editToken: string;
};

export type EditPageIndividualContext = {
  kind: 'individual';
  recipients: IndividualRecipientManagerItem[];
};

export type EditPageIndividualLoadErrorContext = {
  kind: 'individual_load_error';
};

export type EditPageContext =
  | EditPageNotFoundContext
  | EditPageExpiredContext
  | EditPageNeedsPinContext
  | EditPageSharedContext
  | EditPageIndividualContext
  | EditPageIndividualLoadErrorContext;

function isIndividualEditBlocked(card: CardWithOrder): boolean {
  if (card.status === 'disabled' || card.status === 'expired') {
    return true;
  }
  return isParentLifecycleExpired(card);
}

function formatParentExpiryLabel(card: CardWithOrder): string | null {
  const expiresAt = getEffectiveExpiry(card);
  if (!expiresAt) return null;
  return format(expiresAt, 'd MMMM yyyy');
}

export function buildIndividualEditPageContext(
  card: CardWithOrder,
  recipients: DigitalCardRecipient[]
): EditPageIndividualContext | EditPageIndividualLoadErrorContext | EditPageExpiredContext {
  if (isIndividualEditBlocked(card)) {
    return {
      kind: 'expired',
      expiredOn: formatParentExpiryLabel(card),
    };
  }

  if (recipients.length === 0) {
    return { kind: 'individual_load_error' };
  }

  const safeRecipients = sortRecipientsByNumber(
    recipients.map((row) => toIndividualRecipientManagerItem(row))
  );
  assertSafeManagerItems(safeRecipients);

  return {
    kind: 'individual',
    recipients: safeRecipients,
  };
}

export async function loadEditPageContext(editToken: string): Promise<EditPageContext> {
  const trimmed = editToken?.trim();
  if (!trimmed) {
    return { kind: 'not_found' };
  }

  const { card, error } = await getCardByEditTokenForLoader(trimmed);
  if (error || !card) {
    return { kind: 'not_found' };
  }

  // Lazy-generate Edit PIN for legacy cards (once).
  await ensureEditPinForCard(card.id);

  const pinSessionOk = await hasValidEditPinSession(trimmed);
  if (!pinSessionOk) {
    return { kind: 'needs_edit_pin', editToken: trimmed };
  }

  if (card.card_mode === 'shared') {
    return { kind: 'shared', editToken: trimmed };
  }

  if (card.card_mode !== 'individual') {
    return { kind: 'not_found' };
  }

  if (isIndividualEditBlocked(card)) {
    return {
      kind: 'expired',
      expiredOn: formatParentExpiryLabel(card),
    };
  }

  const supabase = getSupabaseAdmin();
  const { recipients, error: recipientsError } = await getRecipientsForCard(supabase, card.id);

  if (recipientsError) {
    return { kind: 'individual_load_error' };
  }

  return buildIndividualEditPageContext(card, recipients);
}
