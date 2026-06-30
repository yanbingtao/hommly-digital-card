'use server';

import { getSupabase, getConnectionErrorMessage } from './supabase';
import { assertAdminAuthenticated } from './admin-auth';
import { DigitalCard, CardWithOrder } from './types';
import crypto from 'crypto';
import { resolveViewPinFields, verifyViewPin } from './view-pin-crypto';
import { isValidViewPin } from './view-pin';
import { getReactivationExpiryDate } from './card-expiry';

function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function formatOrderTimestamp(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return (
    String(date.getFullYear()) +
    pad(date.getMonth() + 1) +
    pad(date.getDate()) +
    pad(date.getHours()) +
    pad(date.getMinutes()) +
    pad(date.getSeconds())
  );
}

function buildOrderNumber(input: string): string {
  return `${input.trim()}-${formatOrderTimestamp(new Date())}`;
}

export async function createCard(data: {
  order_number: string;
}): Promise<{ card: CardWithOrder | null; error: string | null }> {
  try {
    await assertAdminAuthenticated();
    const supabase = getSupabase();
    const orderNumber = buildOrderNumber(data.order_number);
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        order_number: orderNumber,
      })
      .select()
      .single();

    if (orderError || !order) {
      return { card: null, error: orderError?.message || 'Failed to create order' };
    }

    const publicToken = generateToken();
    const editToken = generateToken();

    const { data: card, error: cardError } = await supabase
      .from('digital_cards')
      .insert({
        order_id: order.id,
        public_token: publicToken,
        edit_token: editToken,
      })
      .select()
      .single();

    if (cardError || !card) {
      return { card: null, error: cardError?.message || 'Failed to create digital card' };
    }

    return {
      card: { ...card, order } as CardWithOrder,
      error: null,
    };
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

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('digital_cards')
      .select('view_pin_enabled, view_pin_hash')
      .eq('public_token', publicToken)
      .maybeSingle();

    if (error) {
      return { success: false, error: null };
    }

    if (!data?.view_pin_enabled || !data.view_pin_hash) {
      return { success: true, error: null };
    }

    return {
      success: verifyViewPin(pin, data.view_pin_hash),
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

export async function deleteCard(
  cardId: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    await assertAdminAuthenticated();
    const supabase = getSupabase();

    const { data: card, error: fetchError } = await supabase
      .from('digital_cards')
      .select('id, order_id')
      .eq('id', cardId)
      .maybeSingle();

    if (fetchError) {
      return { success: false, error: fetchError.message };
    }

    if (!card) {
      return { success: false, error: 'Card not found' };
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
