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
import { deleteCardPhoto, clearCardPhotoMetadata } from './card-photo-storage';
import { createCardCore } from './create-card-core';

export async function createCard(data: {
  order_number: string;
}): Promise<{ card: CardWithOrder | null; error: string | null }> {
  try {
    await assertAdminAuthenticated();
    const result = await createCardCore(getSupabase(), {
      orderNumberInput: data.order_number,
    });
    if (!result.ok) {
      return { card: null, error: result.error };
    }
    return { card: result.card, error: null };
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'Unauthorized') {
      return { card: null, error: 'Unauthorized. Please sign in again.' };
    }
    return { card: null, error: getConnectionErrorMessage(err) };
  }
}

export async function getCards(): Promise<{ cards: CardWithOrder[] | null; error: string | null }> {
  try {
    await assertAdminAuthenticated();
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('digital_cards')
      .select('*, order:orders(*)')
      .order('created_at', { ascending: false });

    if (error) {
      return { cards: null, error: error.message };
    }

    return { cards: data as CardWithOrder[] | null, error: null };
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'Unauthorized') {
      return { cards: null, error: 'Unauthorized. Please sign in again.' };
    }
    return { cards: null, error: getConnectionErrorMessage(err) };
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
  result: { scanned: number; cleaned: number; errors: string[] } | null;
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
      .select('id, order_id, photo_path')
      .eq('id', cardId)
      .maybeSingle();

    if (fetchError) {
      return { success: false, error: fetchError.message };
    }

    if (!card) {
      return { success: false, error: 'Card not found' };
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
