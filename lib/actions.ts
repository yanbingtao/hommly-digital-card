'use server';

import { getSupabase, getConnectionErrorMessage } from './supabase';
import { DigitalCard, CardWithOrder } from './types';
import crypto from 'crypto';

function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export async function createCard(data: {
  order_number: string;
  buyer_name: string;
}): Promise<{ card: CardWithOrder | null; error: string | null }> {
  try {
    const supabase = getSupabase();
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        order_number: data.order_number,
        buyer_name: data.buyer_name,
        buyer_email: '',
        buyer_phone: '',
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
    return { card: null, error: getConnectionErrorMessage(err) };
  }
}

export async function getCards(): Promise<{ cards: CardWithOrder[] | null; error: string | null }> {
  try {
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
      return { card: null, error: error.message };
    }

    return { card: data as CardWithOrder | null, error: null };
  } catch (err: unknown) {
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
    recipient_name?: string;
    sender_name?: string;
    message?: string;
    photo_url?: string;
    theme?: string;
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

export async function publishCard(editToken: string): Promise<{ card: DigitalCard | null; error: string | null }> {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('digital_cards')
      .update({
        status: 'published',
        published_at: new Date().toISOString(),
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
