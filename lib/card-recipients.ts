import type { SupabaseClient } from '@supabase/supabase-js';
import { generateRecipientViewToken } from './card-tokens';
import type { DigitalCardRecipient } from './types';

const RECIPIENT_SELECT =
  'id, digital_card_id, recipient_number, view_token, message, theme, animation, show_sender_links, sender_links, view_pin_enabled, view_pin_hash, photo_path, photo_original_name, photo_mime_type, photo_size_bytes, photo_uploaded_at, status, published_at, created_at, updated_at';

export type BuildRecipientRowInput = {
  digital_card_id: string;
  recipient_number: number;
  view_token?: string;
};

export type BuildRecipientRowsInput = {
  digital_card_id: string;
  recipient_count: number;
  generateViewToken?: () => string;
};

/**
 * Presentation label for a recipient slot (database stores integers only).
 * @example formatRecipientNumber(1) → "Gift #01"
 * @example formatRecipientNumber(100) → "Gift #100"
 */
export function formatRecipientNumber(recipientNumber: number): string {
  if (!Number.isInteger(recipientNumber) || recipientNumber <= 0) {
    throw new RangeError('recipient_number must be a positive integer');
  }
  const width = Math.max(2, String(recipientNumber).length);
  return `Gift #${String(recipientNumber).padStart(width, '0')}`;
}

export function buildRecipientRow(input: BuildRecipientRowInput): Pick<
  DigitalCardRecipient,
  'digital_card_id' | 'recipient_number' | 'view_token'
> & {
  theme: string;
  animation: string;
  show_sender_links: boolean;
  view_pin_enabled: boolean;
  status: string;
} {
  if (!Number.isInteger(input.recipient_number) || input.recipient_number <= 0) {
    throw new RangeError('recipient_number must be a positive integer');
  }

  return {
    digital_card_id: input.digital_card_id,
    recipient_number: input.recipient_number,
    view_token: input.view_token ?? generateRecipientViewToken(),
    theme: 'thank_you',
    animation: 'soft_reveal',
    show_sender_links: false,
    view_pin_enabled: false,
    status: 'draft',
  };
}

/**
 * Builds draft recipient row payloads for bulk insert (Individual mode — not wired in Phase 1).
 */
export function buildRecipientRows(input: BuildRecipientRowsInput): ReturnType<typeof buildRecipientRow>[] {
  const { digital_card_id, recipient_count } = input;
  if (!Number.isInteger(recipient_count) || recipient_count <= 0) {
    throw new RangeError('recipient_count must be a positive integer');
  }

  const tokenFactory = input.generateViewToken ?? generateRecipientViewToken;
  const rows: ReturnType<typeof buildRecipientRow>[] = [];
  const usedTokens = new Set<string>();

  for (let recipient_number = 1; recipient_number <= recipient_count; recipient_number += 1) {
    let view_token = tokenFactory();
    while (usedTokens.has(view_token)) {
      view_token = tokenFactory();
    }
    usedTokens.add(view_token);
    rows.push(buildRecipientRow({ digital_card_id, recipient_number, view_token }));
  }

  return rows;
}

export async function getRecipientsForCard(
  supabase: SupabaseClient,
  digitalCardId: string
): Promise<{ recipients: DigitalCardRecipient[]; error: string | null }> {
  const { data, error } = await supabase
    .from('digital_card_recipients')
    .select(RECIPIENT_SELECT)
    .eq('digital_card_id', digitalCardId)
    .order('recipient_number', { ascending: true });

  if (error) {
    return { recipients: [], error: error.message };
  }

  return { recipients: (data ?? []) as DigitalCardRecipient[], error: null };
}

export async function getRecipientByViewToken(
  supabase: SupabaseClient,
  viewToken: string
): Promise<{ recipient: DigitalCardRecipient | null; error: string | null }> {
  const trimmed = viewToken?.trim();
  if (!trimmed) {
    return { recipient: null, error: 'view_token is required' };
  }

  const { data, error } = await supabase
    .from('digital_card_recipients')
    .select(RECIPIENT_SELECT)
    .eq('view_token', trimmed)
    .maybeSingle();

  if (error) {
    return { recipient: null, error: error.message };
  }

  return { recipient: (data as DigitalCardRecipient | null) ?? null, error: null };
}

export async function getRecipientByNumber(
  supabase: SupabaseClient,
  digitalCardId: string,
  recipientNumber: number
): Promise<{ recipient: DigitalCardRecipient | null; error: string | null }> {
  if (!Number.isInteger(recipientNumber) || recipientNumber <= 0) {
    return { recipient: null, error: 'recipient_number must be a positive integer' };
  }

  const { data, error } = await supabase
    .from('digital_card_recipients')
    .select(RECIPIENT_SELECT)
    .eq('digital_card_id', digitalCardId)
    .eq('recipient_number', recipientNumber)
    .maybeSingle();

  if (error) {
    return { recipient: null, error: error.message };
  }

  return { recipient: (data as DigitalCardRecipient | null) ?? null, error: null };
}
