import type { SupabaseClient } from '@supabase/supabase-js';
import { buildRecipientRows, getRecipientsForCard } from './card-recipients';
import {
  buildOrderNumber,
  findCardByPlatformOrder,
} from './create-card-core';
import { generateEditToken, generatePublicToken, generateRecipientViewToken } from './card-tokens';
import { validateIndividualRecipientCount } from './individual-recipient-count';
import type { CardMode, CardWithOrder, DigitalCardRecipient } from './types';

export const INDIVIDUAL_ERROR = {
  INVALID_RECIPIENT_COUNT: 'INVALID_RECIPIENT_COUNT',
  ORDER_NUMBER_REQUIRED: 'ORDER_NUMBER_REQUIRED',
  CARD_MODE_MISMATCH: 'CARD_MODE_MISMATCH',
  INDIVIDUAL_RECIPIENT_COUNT_MISMATCH: 'INDIVIDUAL_RECIPIENT_COUNT_MISMATCH',
  INDIVIDUAL_CREATION_INCOMPLETE: 'INDIVIDUAL_CREATION_INCOMPLETE',
  FAILED_TO_CREATE_ORDER: 'FAILED_TO_CREATE_ORDER',
  FAILED_TO_CREATE_CARD: 'FAILED_TO_CREATE_CARD',
  FAILED_TO_CREATE_RECIPIENTS: 'FAILED_TO_CREATE_RECIPIENTS',
  FAILED_TO_LOAD_RECIPIENTS: 'FAILED_TO_LOAD_RECIPIENTS',
} as const;

export type IndividualCardCreationSuccess = {
  ok: true;
  card: CardWithOrder;
  recipients: DigitalCardRecipient[];
  existing: boolean;
};

export type IndividualCardCreationFailure = {
  ok: false;
  code: (typeof INDIVIDUAL_ERROR)[keyof typeof INDIVIDUAL_ERROR];
  message: string;
  existing?: number;
  requested?: number;
  existingMode?: CardMode;
  requestedMode?: CardMode;
};

export type IndividualCardCreationResult =
  | IndividualCardCreationSuccess
  | IndividualCardCreationFailure;

export type CreateIndividualCardCoreInput = {
  orderNumberInput: string;
  recipientCount: number;
  platform?: string | null;
  externalOrderId?: string | null;
  now?: Date;
  tokenFactory?: () => string;
  recipientTokenFactory?: () => string;
};

const RECIPIENT_INSERT_SELECT =
  'id, digital_card_id, recipient_number, view_token, message, theme, animation, show_sender_links, sender_links, view_pin_enabled, view_pin_hash, photo_path, photo_original_name, photo_mime_type, photo_size_bytes, photo_uploaded_at, status, published_at, created_at, updated_at';

const CARD_TOKEN_MAX_ATTEMPTS = 5;
const RECIPIENT_INSERT_MAX_ATTEMPTS = 3;

function hasContiguousRecipientNumbers(
  recipients: DigitalCardRecipient[],
  expectedCount: number
): boolean {
  if (recipients.length !== expectedCount) return false;
  const numbers = recipients.map((row) => row.recipient_number).sort((a, b) => a - b);
  for (let index = 0; index < expectedCount; index += 1) {
    if (numbers[index] !== index + 1) return false;
  }
  return true;
}

function sortRecipients(recipients: DigitalCardRecipient[]): DigitalCardRecipient[] {
  return [...recipients].sort((a, b) => a.recipient_number - b.recipient_number);
}

async function loadExistingIndividualResult(
  supabase: SupabaseClient,
  card: CardWithOrder,
  requestedCount: number,
  recipientTokenFactory: () => string
): Promise<IndividualCardCreationResult> {
  const { recipients, error } = await getRecipientsForCard(supabase, card.id);
  if (error) {
    return {
      ok: false,
      code: INDIVIDUAL_ERROR.FAILED_TO_LOAD_RECIPIENTS,
      message: error,
    };
  }

  const sorted = sortRecipients(recipients);

  if (sorted.length === 0) {
    const inserted = await insertRecipientsForCard(
      supabase,
      card.id,
      requestedCount,
      recipientTokenFactory
    );
    if (!inserted.ok) return inserted;
    return {
      ok: true,
      card,
      recipients: inserted.recipients,
      existing: false,
    };
  }

  if (sorted.length !== requestedCount) {
    return {
      ok: false,
      code: INDIVIDUAL_ERROR.INDIVIDUAL_RECIPIENT_COUNT_MISMATCH,
      message: `INDIVIDUAL_RECIPIENT_COUNT_MISMATCH existing=${sorted.length} requested=${requestedCount}`,
      existing: sorted.length,
      requested: requestedCount,
    };
  }

  if (!hasContiguousRecipientNumbers(sorted, requestedCount)) {
    return {
      ok: false,
      code: INDIVIDUAL_ERROR.INDIVIDUAL_CREATION_INCOMPLETE,
      message: `INDIVIDUAL_CREATION_INCOMPLETE existing=${sorted.length} requested=${requestedCount}`,
      existing: sorted.length,
      requested: requestedCount,
    };
  }

  return {
    ok: true,
    card,
    recipients: sorted,
    existing: true,
  };
}

async function insertRecipientsForCard(
  supabase: SupabaseClient,
  digitalCardId: string,
  recipientCount: number,
  recipientTokenFactory: () => string
): Promise<
  | { ok: true; recipients: DigitalCardRecipient[] }
  | IndividualCardCreationFailure
> {
  for (let attempt = 0; attempt < RECIPIENT_INSERT_MAX_ATTEMPTS; attempt += 1) {
    const draftRows = buildRecipientRows({
      digital_card_id: digitalCardId,
      recipient_count: recipientCount,
      generateViewToken: recipientTokenFactory,
    });

    const { data, error } = await supabase
      .from('digital_card_recipients')
      .insert(draftRows)
      .select(RECIPIENT_INSERT_SELECT);

    if (!error && data) {
      return { ok: true, recipients: sortRecipients(data as DigitalCardRecipient[]) };
    }

    if (error?.code !== '23505') {
      return {
        ok: false,
        code: INDIVIDUAL_ERROR.FAILED_TO_CREATE_RECIPIENTS,
        message: error?.message || 'Failed to create recipient rows',
      };
    }
  }

  return {
    ok: false,
    code: INDIVIDUAL_ERROR.FAILED_TO_CREATE_RECIPIENTS,
    message: 'Failed to generate unique recipient view tokens after retries',
  };
}

/**
 * Creates one Individual parent card plus N recipient rows.
 * Not wired to production routes in Phase 2.
 *
 * Transaction strategy: multi-step inserts with deterministic recovery (no RPC).
 * If parent exists with zero recipients, missing recipients are inserted on retry.
 * Partial recipient sets never grow silently; count mismatches return explicit errors.
 */
export async function createIndividualCardCore(
  supabase: SupabaseClient,
  input: CreateIndividualCardCoreInput
): Promise<IndividualCardCreationResult> {
  const orderNumberInput = input.orderNumberInput.trim();
  if (!orderNumberInput) {
    return {
      ok: false,
      code: INDIVIDUAL_ERROR.ORDER_NUMBER_REQUIRED,
      message: 'order number is required',
    };
  }

  const countValidation = validateIndividualRecipientCount(input.recipientCount);
  if (!countValidation.ok) {
    return {
      ok: false,
      code: INDIVIDUAL_ERROR.INVALID_RECIPIENT_COUNT,
      message: countValidation.error,
    };
  }
  const recipientCount = countValidation.count;

  const platform = (input.platform || '').trim() || null;
  const externalOrderId = (input.externalOrderId || '').trim() || null;
  const now = input.now ?? new Date();
  const publicTokenFactory = input.tokenFactory ?? generatePublicToken;
  const recipientTokenFactory = input.recipientTokenFactory ?? generateRecipientViewToken;

  if (platform && externalOrderId) {
    const existing = await findCardByPlatformOrder(supabase, platform, externalOrderId);
    if (existing) {
      const existingMode: CardMode = existing.card_mode ?? 'shared';
      if (existingMode !== 'individual') {
        return {
          ok: false,
          code: INDIVIDUAL_ERROR.CARD_MODE_MISMATCH,
          message: `CARD_MODE_MISMATCH existing=${existingMode} requested=individual`,
          existingMode,
          requestedMode: 'individual',
        };
      }
      return loadExistingIndividualResult(
        supabase,
        existing,
        recipientCount,
        recipientTokenFactory
      );
    }
  }

  const orderNumber = buildOrderNumber(orderNumberInput, now);
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({ order_number: orderNumber })
    .select()
    .single();

  if (orderError || !order) {
    return {
      ok: false,
      code: INDIVIDUAL_ERROR.FAILED_TO_CREATE_ORDER,
      message: orderError?.message || 'Failed to create order',
    };
  }

  let card: Record<string, unknown> | null = null;
  let cardError: { message: string; code?: string } | null = null;

  for (let attempt = 0; attempt < CARD_TOKEN_MAX_ATTEMPTS; attempt += 1) {
    const insertRow: Record<string, unknown> = {
      order_id: order.id,
      card_mode: 'individual',
      public_token: publicTokenFactory(),
      edit_token: generateEditToken(order.order_number as string),
    };
    if (platform && externalOrderId) {
      insertRow.platform = platform;
      insertRow.external_order_id = externalOrderId;
    }

    const result = await supabase.from('digital_cards').insert(insertRow).select().single();
    card = result.data;
    cardError = result.error;

    if (!cardError) break;

    if (cardError.code !== '23505') break;

    if (platform && externalOrderId) {
      const raced = await findCardByPlatformOrder(supabase, platform, externalOrderId);
      if (raced) {
        const racedMode: CardMode = raced.card_mode ?? 'shared';
        if (racedMode !== 'individual') {
          return {
            ok: false,
            code: INDIVIDUAL_ERROR.CARD_MODE_MISMATCH,
            message: `CARD_MODE_MISMATCH existing=${racedMode} requested=individual`,
            existingMode: racedMode,
            requestedMode: 'individual',
          };
        }
        return loadExistingIndividualResult(
          supabase,
          raced,
          recipientCount,
          recipientTokenFactory
        );
      }
    }
  }

  if (cardError || !card) {
    return {
      ok: false,
      code: INDIVIDUAL_ERROR.FAILED_TO_CREATE_CARD,
      message: cardError?.message || 'Failed to create digital card',
    };
  }

  const cardWithOrder = { ...card, order } as CardWithOrder;
  const inserted = await insertRecipientsForCard(
    supabase,
    cardWithOrder.id,
    recipientCount,
    recipientTokenFactory
  );

  if (!inserted.ok) {
    return inserted;
  }

  return {
    ok: true,
    card: cardWithOrder,
    recipients: inserted.recipients,
    existing: false,
  };
}

/** Exported for tests — verifies contiguous numbering 1..N. */
export function verifyRecipientNumbering(
  recipients: DigitalCardRecipient[],
  expectedCount: number
): boolean {
  return hasContiguousRecipientNumbers(recipients, expectedCount);
}
