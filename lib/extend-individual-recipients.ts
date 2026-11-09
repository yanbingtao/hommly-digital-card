import type { SupabaseClient } from '@supabase/supabase-js';
import { buildRecipientRow, getRecipientsForCard } from './card-recipients';
import { findCardByPlatformOrder } from './create-card-core';
import { generateRecipientViewToken } from './card-tokens';
import { validateIndividualRecipientCount } from './individual-recipient-count';
import type { CardWithOrder, DigitalCardRecipient } from './types';

export const EXTENSION_ERROR = {
  INVALID_RECIPIENT_COUNT: 'INVALID_RECIPIENT_COUNT',
  SET_NOT_FOUND: 'SET_NOT_FOUND',
  CARD_MODE_MISMATCH: 'CARD_MODE_MISMATCH',
  RECIPIENT_COUNT_DECREASE_REJECTED: 'RECIPIENT_COUNT_DECREASE_REJECTED',
  EXTENSION_PARTIAL: 'EXTENSION_PARTIAL',
  EXTENSION_CONFLICT: 'EXTENSION_CONFLICT',
  EXISTING_RECIPIENT_CHANGED: 'EXISTING_RECIPIENT_CHANGED',
  FAILED_TO_LOAD_RECIPIENTS: 'FAILED_TO_LOAD_RECIPIENTS',
} as const;

const INSERT_SELECT =
  'id, digital_card_id, recipient_number, view_token, message, theme, animation, show_sender_links, sender_links, view_pin_enabled, view_pin_hash, photo_media_id, photo_path, photo_original_name, photo_mime_type, photo_size_bytes, photo_uploaded_at, status, published_at, created_at, updated_at';

const MAX_PASSES = 5;

export type ExtendIndividualRecipientsSuccess = {
  ok: true;
  status: 'extended' | 'unchanged';
  card: CardWithOrder;
  recipients: DigitalCardRecipient[];
  addedNumbers: number[];
};

export type ExtendIndividualRecipientsFailure = {
  ok: false;
  code: (typeof EXTENSION_ERROR)[keyof typeof EXTENSION_ERROR];
  message: string;
  existingCount?: number;
  requestedCount?: number;
  addedNumbers?: number[];
};

export type ExtendIndividualRecipientsResult =
  | ExtendIndividualRecipientsSuccess
  | ExtendIndividualRecipientsFailure;

export type ExtendIndividualRecipientsInput = {
  platform: string;
  externalOrderId: string;
  recipientCount: number;
  recipientTokenFactory?: () => string;
};

function sortRecipients(recipients: DigitalCardRecipient[]): DigitalCardRecipient[] {
  return [...recipients].sort((a, b) => a.recipient_number - b.recipient_number);
}

function missingNumbers(recipients: DigitalCardRecipient[], target: number): number[] {
  const present = new Set(recipients.map((row) => row.recipient_number));
  const missing: number[] = [];
  for (let number = 1; number <= target; number += 1) {
    if (!present.has(number)) missing.push(number);
  }
  return missing;
}

function identityChanged(
  before: DigitalCardRecipient,
  after: DigitalCardRecipient | undefined
): boolean {
  if (!after) return true;
  return (
    after.id !== before.id ||
    after.view_token !== before.view_token ||
    after.message !== before.message ||
    after.theme !== before.theme ||
    after.animation !== before.animation ||
    after.photo_path !== before.photo_path ||
    after.view_pin_hash !== before.view_pin_hash ||
    after.view_pin_enabled !== before.view_pin_enabled ||
    after.created_at !== before.created_at
  );
}

/**
 * Add missing Individual recipients. Never updates the parent card or an existing recipient row.
 */
export async function extendIndividualRecipients(
  supabase: SupabaseClient,
  input: ExtendIndividualRecipientsInput
): Promise<ExtendIndividualRecipientsResult> {
  const countValidation = validateIndividualRecipientCount(input.recipientCount);
  if (!countValidation.ok) {
    return {
      ok: false,
      code: EXTENSION_ERROR.INVALID_RECIPIENT_COUNT,
      message: countValidation.error,
    };
  }
  const target = countValidation.count;
  const platform = input.platform.trim();
  const externalOrderId = input.externalOrderId.trim();
  const tokenFactory = input.recipientTokenFactory ?? generateRecipientViewToken;

  const card = await findCardByPlatformOrder(supabase, platform, externalOrderId);
  if (!card) {
    return {
      ok: false,
      code: EXTENSION_ERROR.SET_NOT_FOUND,
      message: 'No E-Card Set exists for this order',
    };
  }
  if ((card.card_mode ?? 'shared') !== 'individual') {
    return {
      ok: false,
      code: EXTENSION_ERROR.CARD_MODE_MISMATCH,
      message: 'Only an individual set can gain recipients',
    };
  }

  const addedNumbers: number[] = [];

  for (let pass = 0; pass < MAX_PASSES; pass += 1) {
    const loaded = await getRecipientsForCard(supabase, card.id);
    if (loaded.error) {
      return {
        ok: false,
        code: EXTENSION_ERROR.FAILED_TO_LOAD_RECIPIENTS,
        message: loaded.error,
        addedNumbers,
      };
    }
    const current = sortRecipients(loaded.recipients);
    const highest = current.reduce((max, row) => Math.max(max, row.recipient_number), 0);
    if (current.length > target || highest > target) {
      return {
        ok: false,
        code: EXTENSION_ERROR.RECIPIENT_COUNT_DECREASE_REJECTED,
        message: `recipient count cannot decrease from ${Math.max(current.length, highest)} to ${target}`,
        existingCount: current.length,
        requestedCount: target,
        addedNumbers,
      };
    }

    const missing = missingNumbers(current, target);
    if (missing.length === 0) {
      return {
        ok: true,
        status: addedNumbers.length === 0 ? 'unchanged' : 'extended',
        card,
        recipients: current,
        addedNumbers,
      };
    }

    let conflict = false;
    for (const number of missing) {
      const draft = buildRecipientRow({
        digital_card_id: card.id,
        recipient_number: number,
        view_token: tokenFactory(),
      });
      const inserted = await supabase
        .from('digital_card_recipients')
        .insert(draft)
        .select(INSERT_SELECT)
        .single();
      if (inserted.error) {
        if (inserted.error.code === '23505') {
          conflict = true;
          break;
        }
        return {
          ok: false,
          code: EXTENSION_ERROR.EXTENSION_PARTIAL,
          message: inserted.error.message || 'Failed to add a recipient',
          existingCount: current.length,
          requestedCount: target,
          addedNumbers,
        };
      }
      addedNumbers.push(number);
    }
    if (conflict) continue;

    const verified = await getRecipientsForCard(supabase, card.id);
    if (verified.error) {
      return {
        ok: false,
        code: EXTENSION_ERROR.FAILED_TO_LOAD_RECIPIENTS,
        message: verified.error,
        addedNumbers,
      };
    }
    const after = sortRecipients(verified.recipients);
    for (const before of current) {
      const match = after.find((row) => row.recipient_number === before.recipient_number);
      if (identityChanged(before, match)) {
        return {
          ok: false,
          code: EXTENSION_ERROR.EXISTING_RECIPIENT_CHANGED,
          message: `Recipient ${before.recipient_number} changed during extension`,
          addedNumbers,
        };
      }
    }
    if (missingNumbers(after, target).length === 0 && after.length === target) {
      return {
        ok: true,
        status: 'extended',
        card,
        recipients: after,
        addedNumbers,
      };
    }
  }

  return {
    ok: false,
    code: EXTENSION_ERROR.EXTENSION_CONFLICT,
    message: 'Recipient extension conflicted with another request',
    requestedCount: target,
    addedNumbers,
  };
}
