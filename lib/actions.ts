'use server';

import { getSupabase, getConnectionErrorMessage } from './supabase';
import { getSupabaseAdmin } from './supabase-admin';
import { assertAdminAuthenticated } from './admin-auth';
import { DigitalCard, CardWithOrder } from './types';
import { resolveViewPinFields, verifyViewPin } from './view-pin-crypto';
import { isValidViewPin } from './view-pin';
import {
  getRecipientViewPinSource,
  isResolvedRecipientViewAvailable,
  resolveRecipientViewToken,
} from './recipient-view-resolver';
import { getReactivationExpiryDate } from './card-expiry';
import { cleanupExpiredCardPhotos } from './card-photo-cleanup';
import { deleteIndividualCardMediaStorage } from './digital-card-media';
import { deleteCardPhoto, clearCardPhotoMetadata } from './card-photo-storage';
import { createCardCore } from './create-card-core';
import { createIndividualCardCore } from './create-individual-card-core';
import {
  aggregateAdminIndividualCardProgress,
  buildAdminIndividualRecipientItems,
  validateAdminIndividualRecipientQuantity,
  type AdminIndividualCardProgress,
} from './admin-card-helpers';
import type {
  AdminCreateIndividualCardResult,
  AdminCreateSharedCardResult,
  AdminIndividualRecipientItem,
} from './admin-card-types';
import { getRecipientsForCard } from './card-recipients';
import { buildBuyerEditUrl } from './individual-card-urls';
import { getCanonicalSiteOrigin } from './internal-card-response';

export type { AdminIndividualCardProgress };

export async function createCard(data: {
  order_number: string;
}): Promise<AdminCreateSharedCardResult> {
  try {
    await assertAdminAuthenticated();
    const result = await createCardCore(getSupabase(), {
      orderNumberInput: data.order_number,
    });
    if (!result.ok) {
      return { ok: false, error: result.error };
    }
    return { ok: true, mode: 'shared', card: result.card };
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'Unauthorized') {
      return { ok: false, error: 'Unauthorized. Please sign in again.' };
    }
    return { ok: false, error: getConnectionErrorMessage(err) };
  }
}

export async function createIndividualCard(data: {
  order_number: string;
  recipient_count: number;
}): Promise<AdminCreateIndividualCardResult> {
  try {
    await assertAdminAuthenticated();

    const orderNumber = data.order_number.trim();
    if (!orderNumber) {
      return { ok: false, error: 'Please enter an order number.' };
    }

    const quantityResult = validateAdminIndividualRecipientQuantity(data.recipient_count);
    if (!quantityResult.ok) {
      return { ok: false, error: quantityResult.error };
    }

    const supabase = getSupabaseAdmin();
    const result = await createIndividualCardCore(supabase, {
      orderNumberInput: orderNumber,
      recipientCount: quantityResult.count,
      platform: null,
      externalOrderId: null,
    });

    if (!result.ok) {
      return {
        ok: false,
        error: "We couldn't create the Individual Card. Please try again.",
      };
    }

    const siteOrigin = getCanonicalSiteOrigin();
    const recipients = buildAdminIndividualRecipientItems(result.recipients, siteOrigin);

    return {
      ok: true,
      mode: 'individual',
      card: result.card,
      recipients,
      editUrl: buildBuyerEditUrl(result.card, siteOrigin),
      quantity: quantityResult.count,
    };
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'Unauthorized') {
      return { ok: false, error: 'Unauthorized. Please sign in again.' };
    }
    return { ok: false, error: "We couldn't create the Individual Card. Please try again." };
  }
}

/**
 * Batched individual-card gift progress for Admin.
 * Uses service-role client because digital_card_recipients has RLS with no anon policies.
 */
async function fetchIndividualCardProgress(
  cardIds: string[]
): Promise<Record<string, AdminIndividualCardProgress>> {
  if (cardIds.length === 0) {
    return {};
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('digital_card_recipients')
    .select('digital_card_id, status, view_token')
    .in('digital_card_id', cardIds);

  if (error || !data) {
    console.error('[getCards] individual recipient progress fetch failed', error?.message);
    return {};
  }

  return aggregateAdminIndividualCardProgress(
    data as Array<{ digital_card_id: string; status: string | null; view_token: string | null }>
  );
}

export async function getAdminIndividualRecipients(cardId: string): Promise<{
  recipients: AdminIndividualRecipientItem[] | null;
  error: string | null;
}> {
  try {
    await assertAdminAuthenticated();
    const supabase = getSupabase();

    const { data: card, error: cardError } = await supabase
      .from('digital_cards')
      .select('id, card_mode')
      .eq('id', cardId)
      .maybeSingle();

    if (cardError || !card) {
      return { recipients: null, error: 'Card not found.' };
    }

    if (card.card_mode !== 'individual') {
      return { recipients: null, error: 'This card is not an Individual card.' };
    }

    const { recipients, error: listError } = await getRecipientsForCard(getSupabaseAdmin(), cardId);
    if (listError) {
      return { recipients: null, error: 'Unable to load recipients.' };
    }

    const siteOrigin = getCanonicalSiteOrigin();
    return {
      recipients: buildAdminIndividualRecipientItems(recipients, siteOrigin),
      error: null,
    };
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'Unauthorized') {
      return { recipients: null, error: 'Unauthorized. Please sign in again.' };
    }
    return { recipients: null, error: getConnectionErrorMessage(err) };
  }
}

export async function getCards(): Promise<{
  cards: CardWithOrder[] | null;
  individualProgress: Record<string, AdminIndividualCardProgress> | null;
  error: string | null;
}> {
  try {
    await assertAdminAuthenticated();
    // Service role + no-store fetch avoids stale Admin summaries after buyer publish.
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('digital_cards')
      .select('*, order:orders(*)')
      .order('created_at', { ascending: false });

    if (error) {
      return { cards: null, individualProgress: null, error: error.message };
    }

    const cards = (data ?? []) as CardWithOrder[];
    const individualIds = cards.filter((card) => card.card_mode === 'individual').map((card) => card.id);
    const individualProgress = await fetchIndividualCardProgress(individualIds);

    return { cards, individualProgress, error: null };
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'Unauthorized') {
      return { cards: null, individualProgress: null, error: 'Unauthorized. Please sign in again.' };
    }
    return { cards: null, individualProgress: null, error: getConnectionErrorMessage(err) };
  }
}

export async function getCardByPublicToken(publicToken: string): Promise<{ card: CardWithOrder | null; error: string | null }> {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('digital_cards')
      .select('*, order:orders(*)')
      .eq('public_token', publicToken)
      .maybeSingle();

    if (error) {
      console.error('[getCardByPublicToken] Database error:', error.message);
      return { card: null, error: error.message };
    }

    if (!data) {
      console.error('[getCardByPublicToken] Card not found');
      return { card: null, error: null };
    }

    return { card: data as CardWithOrder, error: null };
  } catch (err: unknown) {
    console.error('[getCardByPublicToken] Failed to load card:', err);
    return { card: null, error: getConnectionErrorMessage(err) };
  }
}

export async function getCardByEditToken(editToken: string): Promise<{ card: CardWithOrder | null; error: string | null }> {
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

    return { card: data as CardWithOrder | null, error: null };
  } catch (err: unknown) {
    return { card: null, error: getConnectionErrorMessage(err) };
  }
}

export async function updateCard(
  editToken: string,
  updates: {
    message?: string;
    theme?: string;
    show_sender_links?: boolean;
    sender_links?: Record<string, unknown> | null;
    view_pin_enabled?: boolean;
    view_pin_hash?: string | null;
  }
): Promise<{ card: DigitalCard | null; error: string | null }> {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('digital_cards')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('edit_token', editToken)
      .select()
      .single();

    if (error) {
      return { card: null, error: error.message };
    }

    return { card: data as DigitalCard | null, error: null };
  } catch (err: unknown) {
    return { card: null, error: getConnectionErrorMessage(err) };
  }
}

export async function publishCard(
  editToken: string,
  content: {
    message: string;
    theme?: string;
    show_sender_links?: boolean;
    sender_links?: Record<string, unknown> | null;
    view_pin_enabled?: boolean;
    view_pin_hash?: string | null;
  }
): Promise<{ card: DigitalCard | null; error: string | null }> {
  try {
    const supabase = getSupabase();
    const { data: existing } = await supabase
      .from('digital_cards')
      .select('first_published_at')
      .eq('edit_token', editToken)
      .maybeSingle();

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('digital_cards')
      .update({
        message: content.message,
        theme: content.theme || 'thank_you',
        show_sender_links: content.show_sender_links ?? false,
        sender_links: content.show_sender_links ? content.sender_links ?? null : null,
        view_pin_enabled: content.view_pin_enabled ?? false,
        view_pin_hash: content.view_pin_enabled ? content.view_pin_hash ?? null : null,
        status: 'published',
        published_at: now,
        ...(existing?.first_published_at ? {} : { first_published_at: now }),
        updated_at: now,
      })
      .eq('edit_token', editToken)
      .select()
      .single();

    if (error) {
      return { card: null, error: error.message };
    }

    return { card: data as DigitalCard | null, error: null };
  } catch (err: unknown) {
    return { card: null, error: getConnectionErrorMessage(err) };
  }
}

export async function prepareViewPinForSave(
  enabled: boolean,
  pin: string,
  existingHash: string | null
): Promise<{
  view_pin_enabled: boolean;
  view_pin_hash: string | null;
  error: string | null;
}> {
  return resolveViewPinFields(enabled, pin, existingHash);
}

export async function verifyCardViewPin(
  publicToken: string,
  pin: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    if (!isValidViewPin(pin)) {
      return { success: false, error: 'PIN must be 4–6 digits.' };
    }

    const supabase = getSupabaseAdmin();
    const result = await resolveRecipientViewToken(supabase, publicToken);

    if (!result.ok || !isResolvedRecipientViewAvailable(result.resolved)) {
      return { success: false, error: null };
    }

    const pinSource = getRecipientViewPinSource(result.resolved);

    if (!pinSource.view_pin_enabled || !pinSource.view_pin_hash) {
      return { success: true, error: null };
    }

    return {
      success: verifyViewPin(pin, pinSource.view_pin_hash),
      error: null,
    };
  } catch (err: unknown) {
    return { success: false, error: getConnectionErrorMessage(err) };
  }
}

export async function setCardExpiryOverride(
  cardId: string,
  expiresAt: string | null
): Promise<{ card: CardWithOrder | null; error: string | null }> {
  try {
    await assertAdminAuthenticated();
    const supabase = getSupabase();

    let expiresAtOverride: string | null = null;
    if (expiresAt) {
      const parsed = new Date(expiresAt);
      if (Number.isNaN(parsed.getTime())) {
        return { card: null, error: 'Invalid date.' };
      }
      expiresAtOverride = parsed.toISOString();
    }

    const { data, error } = await supabase
      .from('digital_cards')
      .update({
        expires_at_override: expiresAtOverride,
        updated_at: new Date().toISOString(),
      })
      .eq('id', cardId)
      .select('*, order:orders(*)')
      .single();

    if (error) {
      return { card: null, error: error.message };
    }

    return { card: data as CardWithOrder, error: null };
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'Unauthorized') {
      return { card: null, error: 'Unauthorized. Please sign in again.' };
    }
    return { card: null, error: getConnectionErrorMessage(err) };
  }
}

export async function reactivateCard(
  cardId: string
): Promise<{ card: CardWithOrder | null; error: string | null }> {
  const expiresAt = getReactivationExpiryDate().toISOString();
  return setCardExpiryOverride(cardId, expiresAt);
}

export async function runExpiredPhotoCleanup(): Promise<{
  result: Awaited<ReturnType<typeof cleanupExpiredCardPhotos>> | null;
  error: string | null;
}> {
  try {
    await assertAdminAuthenticated();
    const result = await cleanupExpiredCardPhotos();
    return { result, error: null };
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'Unauthorized') {
      return { result: null, error: 'Unauthorized. Please sign in again.' };
    }
    return { result: null, error: getConnectionErrorMessage(err) };
  }
}

export async function adminRemoveCardPhoto(
  cardId: string
): Promise<{ card: CardWithOrder | null; error: string | null }> {
  try {
    await assertAdminAuthenticated();
    const supabase = getSupabase();

    const { data: card, error: fetchError } = await supabase
      .from('digital_cards')
      .select('*, order:orders(*)')
      .eq('id', cardId)
      .maybeSingle();

    if (fetchError || !card) {
      return { card: null, error: fetchError?.message ?? 'Card not found.' };
    }

    if (card.photo_path) {
      await deleteCardPhoto(card.photo_path);
    }

    await clearCardPhotoMetadata(supabase, cardId);

    const { data: updated, error: updateError } = await supabase
      .from('digital_cards')
      .select('*, order:orders(*)')
      .eq('id', cardId)
      .single();

    if (updateError) {
      return { card: null, error: updateError.message };
    }

    return { card: updated as CardWithOrder, error: null };
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'Unauthorized') {
      return { card: null, error: 'Unauthorized. Please sign in again.' };
    }
    return { card: null, error: getConnectionErrorMessage(err) };
  }
}

export async function deleteCard(
  cardId: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    await assertAdminAuthenticated();
    const supabase = getSupabase();

    const { data: card, error: fetchError } = await supabase
      .from('digital_cards')
      .select('id, order_id, card_mode, photo_path')
      .eq('id', cardId)
      .maybeSingle();

    if (fetchError) {
      return { success: false, error: fetchError.message };
    }

    if (!card) {
      return { success: false, error: 'Card not found' };
    }

    if (card.card_mode === 'individual') {
      try {
        await deleteIndividualCardMediaStorage(getSupabaseAdmin(), card.id);
      } catch (err: unknown) {
        console.error('[deleteCard] Individual media cleanup failed:', err);
      }
    }

    if (card.photo_path) {
      try {
        await deleteCardPhoto(card.photo_path);
      } catch (err: unknown) {
        console.error('[deleteCard] Photo cleanup failed:', err);
      }
    }

    const { error: deleteError } = await supabase
      .from('orders')
      .delete()
      .eq('id', card.order_id);

    if (deleteError) {
      return { success: false, error: deleteError.message };
    }

    return { success: true, error: null };
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'Unauthorized') {
      return { success: false, error: 'Unauthorized. Please sign in again.' };
    }
    return { success: false, error: getConnectionErrorMessage(err) };
  }
}
