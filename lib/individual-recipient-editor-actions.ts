'use server';

import { revalidatePath } from 'next/cache';
import { getSupabaseAdmin } from './supabase-admin';
import { getConnectionErrorMessage } from './supabase';
import {
  sortRecipientsByNumber,
  toIndividualRecipientManagerItem,
  type IndividualRecipientManagerItem,
} from './individual-recipient-manager';
import {
  loadIndividualRecipientEditorCore,
  publishIndividualRecipientsCore,
} from './publish-individual-recipients-core';
import { getRecipientsForCard } from './card-recipients';
import type { IndividualRecipientEditorLoadResult } from './individual-recipient-editor-types';

export type PublishIndividualRecipientsActionResult =
  | {
      ok: true;
      updatedRecipientIds: string[];
      updatedCount: number;
      error: null;
    }
  | {
      ok: false;
      updatedRecipientIds: null;
      updatedCount: null;
      error: string;
    };

export async function loadIndividualRecipientEditor(input: {
  edit_token: string;
  recipient_ids: string[];
}): Promise<{ data: IndividualRecipientEditorLoadResult | null; error: string | null }> {
  try {
    const supabase = getSupabaseAdmin();
    const result = await loadIndividualRecipientEditorCore(supabase, {
      editToken: input.edit_token,
      recipientIds: input.recipient_ids,
    });
    if (!result.ok) {
      return { data: null, error: result.error };
    }
    return { data: result.data, error: null };
  } catch (err: unknown) {
    return { data: null, error: getConnectionErrorMessage(err) };
  }
}

export async function getIndividualRecipientPhotoPreview(input: {
  edit_token: string;
  recipient_ids: string[];
}): Promise<{ signedUrl: string | null; mixed: boolean; error: string | null }> {
  try {
    const supabase = getSupabaseAdmin();
    const { resolveIndividualRecipientPhotoPreviewUrl } = await import('./individual-recipient-photo');
    return await resolveIndividualRecipientPhotoPreviewUrl(supabase, {
      editToken: input.edit_token,
      recipientIds: input.recipient_ids,
    });
  } catch (err: unknown) {
    return { signedUrl: null, mixed: false, error: getConnectionErrorMessage(err) };
  }
}

export async function publishIndividualRecipients(input: {
  edit_token: string;
  recipient_ids: string[];
  content: {
    message: string;
    theme: string;
    show_sender_links: boolean;
    sender_links: Record<string, unknown> | null;
    view_pin_enabled: boolean;
    view_pin: string;
    photo_enabled: boolean;
    photo_file_base64?: string | null;
    photo_mime_type?: string | null;
    photo_original_name?: string | null;
    photo_size_bytes?: number | null;
  };
}): Promise<PublishIndividualRecipientsActionResult> {
  try {
    const supabase = getSupabaseAdmin();
    const result = await publishIndividualRecipientsCore(supabase, {
      editToken: input.edit_token,
      recipientIds: input.recipient_ids,
      content: input.content,
    });
    if (!result.ok) {
      return {
        ok: false,
        updatedRecipientIds: null,
        updatedCount: null,
        error: result.error,
      };
    }

    revalidatePath(`/e/${input.edit_token.trim()}`);

    return {
      ok: true,
      updatedRecipientIds: result.updatedRecipientIds,
      updatedCount: result.updatedCount,
      error: null,
    };
  } catch (err: unknown) {
    return {
      ok: false,
      updatedRecipientIds: null,
      updatedCount: null,
      error: getConnectionErrorMessage(err),
    };
  }
}

export async function refreshIndividualRecipientManager(input: {
  edit_token: string;
}): Promise<{ recipients: IndividualRecipientManagerItem[] | null; error: string | null }> {
  try {
    const supabase = getSupabaseAdmin();
    const trimmed = input.edit_token?.trim();
    if (!trimmed) {
      return { recipients: null, error: 'Invalid edit link.' };
    }

    const { data: card, error: cardError } = await supabase
      .from('digital_cards')
      .select('id, card_mode, edit_token')
      .eq('edit_token', trimmed)
      .maybeSingle();

    if (cardError || !card || card.card_mode !== 'individual') {
      return { recipients: null, error: 'Unable to refresh gifts.' };
    }

    const { recipients, error: listError } = await getRecipientsForCard(supabase, card.id);
    if (listError) {
      return { recipients: null, error: 'Unable to refresh gifts.' };
    }

    return {
      recipients: sortRecipientsByNumber(recipients.map((row) => toIndividualRecipientManagerItem(row))),
      error: null,
    };
  } catch (err: unknown) {
    return { recipients: null, error: getConnectionErrorMessage(err) };
  }
}
