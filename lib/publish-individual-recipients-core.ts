import type { SupabaseClient } from '@supabase/supabase-js';
import { getRecipientsForCard } from './card-recipients';
import { isValidCardTheme } from './card-theme';
import {
  assertSafeEditorItems,
  buildIndividualEditorLoadResult,
  normalizeUniqueRecipientIds,
  toIndividualRecipientEditorItem,
} from './individual-recipient-editor-prefill';
import type { IndividualRecipientEditorLoadResult } from './individual-recipient-editor-types';
import { resolveBulkViewPinFields } from './individual-recipient-pin';
import {
  buildSenderLinksFromForm,
  parseSenderLinksFromDb,
  senderLinksToFormInputs,
} from './sender-links';
import type { CardWithOrder, DigitalCardRecipient } from './types';

const RECIPIENT_SELECT =
  'id, digital_card_id, recipient_number, view_token, message, theme, animation, show_sender_links, sender_links, view_pin_enabled, view_pin_hash, photo_path, photo_original_name, photo_mime_type, photo_size_bytes, photo_uploaded_at, status, published_at, created_at, updated_at';

export type PublishIndividualRecipientsInput = {
  editToken: string;
  recipientIds: string[];
  content: {
    message: string;
    theme: string;
    show_sender_links: boolean;
    sender_links: Record<string, unknown> | null;
    view_pin_enabled: boolean;
    view_pin: string;
  };
};

export type PublishIndividualRecipientsResult = {
  ok: true;
  updatedRecipientIds: string[];
  parentFirstPublishedAt: string | null;
} | {
  ok: false;
  error: string;
};

export type LoadIndividualRecipientEditorResult =
  | { ok: true; data: IndividualRecipientEditorLoadResult }
  | { ok: false; error: string };

async function resolveParentByEditToken(
  supabase: SupabaseClient,
  editToken: string
): Promise<{ card: CardWithOrder | null; error: string | null }> {
  const trimmed = editToken?.trim();
  if (!trimmed) {
    return { card: null, error: 'Invalid edit link.' };
  }

  const { data, error } = await supabase
    .from('digital_cards')
    .select('*, order:orders(*)')
    .eq('edit_token', trimmed)
    .maybeSingle();

  if (error) {
    return { card: null, error: 'Unable to load this gift order.' };
  }

  return { card: (data as CardWithOrder | null) ?? null, error: null };
}

export async function loadIndividualRecipientEditorCore(
  supabase: SupabaseClient,
  input: { editToken: string; recipientIds: string[] }
): Promise<LoadIndividualRecipientEditorResult> {
  const recipientIds = normalizeUniqueRecipientIds(input.recipientIds);
  if (recipientIds.length === 0) {
    return { ok: false, error: 'Select at least one gift to personalise.' };
  }

  const { card, error: parentError } = await resolveParentByEditToken(supabase, input.editToken);
  if (parentError || !card) {
    return { ok: false, error: parentError ?? 'Gift order not found.' };
  }

  if (card.card_mode !== 'individual') {
    return { ok: false, error: 'This editor is only available for Individual gifts.' };
  }

  const { recipients: allRecipients, error: listError } = await getRecipientsForCard(
    supabase,
    card.id
  );
  if (listError) {
    return { ok: false, error: 'Unable to load gifts. Please try again later.' };
  }

  const selected = allRecipients.filter((row) => recipientIds.includes(row.id));
  if (selected.length !== recipientIds.length) {
    return { ok: false, error: 'One or more selected gifts could not be found.' };
  }

  for (const row of selected) {
    if (row.digital_card_id !== card.id) {
      return { ok: false, error: 'One or more selected gifts are invalid.' };
    }
  }

  const editorItems = selected.map((row) => toIndividualRecipientEditorItem(row));
  assertSafeEditorItems(editorItems);

  return {
    ok: true,
    data: buildIndividualEditorLoadResult(editorItems, allRecipients.length),
  };
}

function validatePublishContent(
  content: PublishIndividualRecipientsInput['content']
): { ok: true; message: string; theme: string; senderLinks: Record<string, unknown> | null } | { ok: false; error: string } {
  const message = content.message.trim();
  if (!message) {
    return { ok: false, error: 'Please write your message before publishing.' };
  }

  if (!isValidCardTheme(content.theme)) {
    return { ok: false, error: 'Please choose a valid theme.' };
  }

  let senderLinks: Record<string, unknown> | null = null;
  if (content.show_sender_links) {
    const formLinks = senderLinksToFormInputs(parseSenderLinksFromDb(content.sender_links));
    const built = buildSenderLinksFromForm(formLinks);
    if (!built || Object.keys(built).length === 0) {
      return {
        ok: false,
        error: 'Please add at least one valid link, or turn off “Share your links”.',
      };
    }
    senderLinks = built;
  }

  return { ok: true, message, theme: content.theme, senderLinks };
}

export async function publishIndividualRecipientsCore(
  supabase: SupabaseClient,
  input: PublishIndividualRecipientsInput
): Promise<PublishIndividualRecipientsResult> {
  const recipientIds = normalizeUniqueRecipientIds(input.recipientIds);
  if (recipientIds.length === 0) {
    return { ok: false, error: 'Select at least one gift to publish.' };
  }

  const validated = validatePublishContent(input.content);
  if (!validated.ok) {
    return { ok: false, error: validated.error };
  }

  const { card, error: parentError } = await resolveParentByEditToken(supabase, input.editToken);
  if (parentError || !card) {
    return { ok: false, error: parentError ?? 'Gift order not found.' };
  }

  if (card.card_mode !== 'individual') {
    return { ok: false, error: 'This publish action is only available for Individual gifts.' };
  }

  const { data: selectedRows, error: fetchError } = await supabase
    .from('digital_card_recipients')
    .select(RECIPIENT_SELECT)
    .eq('digital_card_id', card.id)
    .in('id', recipientIds);

  if (fetchError || !selectedRows || selectedRows.length !== recipientIds.length) {
    return { ok: false, error: 'One or more selected gifts could not be found.' };
  }

  const recipients = selectedRows as DigitalCardRecipient[];
  for (const row of recipients) {
    if (row.digital_card_id !== card.id) {
      return { ok: false, error: 'One or more selected gifts are invalid.' };
    }
  }

  const pinResult = resolveBulkViewPinFields(
    input.content.view_pin_enabled,
    input.content.view_pin,
    recipients.map((row) => ({
      view_pin_enabled: Boolean(row.view_pin_enabled),
      view_pin_hash: row.view_pin_hash,
    }))
  );
  if (pinResult.error) {
    return { ok: false, error: pinResult.error };
  }

  const now = new Date().toISOString();
  const updatePayload = {
    message: validated.message,
    theme: validated.theme,
    animation: 'soft_reveal',
    show_sender_links: input.content.show_sender_links,
    sender_links: input.content.show_sender_links ? validated.senderLinks : null,
    view_pin_enabled: pinResult.view_pin_enabled,
    view_pin_hash: pinResult.view_pin_hash,
    status: 'published',
    published_at: now,
    updated_at: now,
  };

  const { data: updatedRows, error: updateError } = await supabase
    .from('digital_card_recipients')
    .update(updatePayload)
    .eq('digital_card_id', card.id)
    .in('id', recipientIds)
    .select('id, recipient_number, view_token, message, theme, photo_path, photo_original_name, photo_mime_type, photo_size_bytes, photo_uploaded_at, status, published_at');

  if (updateError || !updatedRows || updatedRows.length !== recipientIds.length) {
    return { ok: false, error: 'Publishing failed. Please try again.' };
  }

  for (const row of updatedRows) {
    const original = recipients.find((item) => item.id === row.id);
    if (!original) continue;
    if (original.view_token !== row.view_token) {
      return { ok: false, error: 'Publishing failed. Please try again.' };
    }
    if (original.recipient_number !== row.recipient_number) {
      return { ok: false, error: 'Publishing failed. Please try again.' };
    }
    if (original.photo_path !== row.photo_path) {
      return { ok: false, error: 'Publishing failed. Please try again.' };
    }
  }

  let parentFirstPublishedAt = card.first_published_at ?? null;
  if (!card.first_published_at) {
    const { data: parentUpdate, error: parentUpdateError } = await supabase
      .from('digital_cards')
      .update({
        first_published_at: now,
        updated_at: now,
      })
      .eq('id', card.id)
      .is('first_published_at', null)
      .select('first_published_at')
      .maybeSingle();

    if (parentUpdateError) {
      return { ok: false, error: 'Publishing failed. Please try again.' };
    }
    parentFirstPublishedAt = (parentUpdate?.first_published_at as string | undefined) ?? now;
  }

  return {
    ok: true,
    updatedRecipientIds: recipientIds,
    parentFirstPublishedAt,
  };
}
