import type { SupabaseClient } from '@supabase/supabase-js';
import type { CardWithOrder, DigitalCardRecipient } from './types';

export type AdminPublishIndividualRecipientInput = {
  cardId: string;
  recipientId: string;
  message: string;
  theme?: string;
};

export type AdminPublishIndividualRecipientResult = {
  recipient: DigitalCardRecipient | null;
  card: CardWithOrder | null;
  error: string | null;
};

const RECIPIENT_SELECT =
  'id, digital_card_id, recipient_number, view_token, message, theme, animation, show_sender_links, sender_links, view_pin_enabled, view_pin_hash, photo_path, photo_original_name, photo_mime_type, photo_size_bytes, photo_uploaded_at, status, published_at, created_at, updated_at';

/**
 * Publishes a single Individual-mode recipient row. Never updates sibling recipients.
 * Sets parent first_published_at on first recipient publish (parent may stay draft).
 */
export async function adminPublishIndividualRecipientCore(
  supabase: SupabaseClient,
  input: AdminPublishIndividualRecipientInput
): Promise<AdminPublishIndividualRecipientResult> {
  const message = input.message.trim();
  if (!message) {
    return { recipient: null, card: null, error: 'Message is required.' };
  }

  const { data: card, error: cardError } = await supabase
    .from('digital_cards')
    .select('*, order:orders(*)')
    .eq('id', input.cardId)
    .maybeSingle();

  if (cardError || !card) {
    return { recipient: null, card: null, error: cardError?.message ?? 'Card not found.' };
  }

  const cardRow = card as CardWithOrder;
  if (cardRow.card_mode !== 'individual') {
    return { recipient: null, card: null, error: 'Card is not an Individual card.' };
  }

  const { data: recipient, error: recipientError } = await supabase
    .from('digital_card_recipients')
    .select(RECIPIENT_SELECT)
    .eq('id', input.recipientId)
    .maybeSingle();

  if (recipientError || !recipient) {
    return { recipient: null, card: null, error: recipientError?.message ?? 'Recipient not found.' };
  }

  const recipientRow = recipient as DigitalCardRecipient;
  if (recipientRow.digital_card_id !== input.cardId) {
    return { recipient: null, card: null, error: 'Recipient does not belong to this card.' };
  }

  const now = new Date().toISOString();

  const { data: updatedRecipient, error: updateError } = await supabase
    .from('digital_card_recipients')
    .update({
      message,
      theme: input.theme || recipientRow.theme || 'thank_you',
      status: 'published',
      published_at: now,
      updated_at: now,
    })
    .eq('id', input.recipientId)
    .eq('digital_card_id', input.cardId)
    .select(RECIPIENT_SELECT)
    .single();

  if (updateError || !updatedRecipient) {
    return {
      recipient: null,
      card: null,
      error: updateError?.message ?? 'Failed to publish recipient.',
    };
  }

  let updatedCard = cardRow;
  if (!cardRow.first_published_at) {
    const { data: parentUpdate, error: parentError } = await supabase
      .from('digital_cards')
      .update({
        first_published_at: now,
        updated_at: now,
      })
      .eq('id', input.cardId)
      .select('*, order:orders(*)')
      .single();

    if (parentError || !parentUpdate) {
      return {
        recipient: updatedRecipient as DigitalCardRecipient,
        card: null,
        error: parentError?.message ?? 'Recipient published but parent lifecycle update failed.',
      };
    }
    updatedCard = parentUpdate as CardWithOrder;
  }

  return {
    recipient: updatedRecipient as DigitalCardRecipient,
    card: updatedCard,
    error: null,
  };
}
