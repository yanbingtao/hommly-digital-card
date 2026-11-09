import type { SupabaseClient } from '@supabase/supabase-js';
import { isAutomationPlatform, type AutomationPlatform } from './create-card-core';
import {
  extendIndividualRecipients,
  EXTENSION_ERROR,
  type ExtendIndividualRecipientsResult,
} from './extend-individual-recipients';
import { buildIndividualInternalCardResponse } from './internal-card-response';
import { isValidAutomationOrderId } from './internal-card-request';
import { validateIndividualRecipientCount } from './individual-recipient-count';

const ALLOWED_KEYS = ['platform', 'order_id', 'recipient_count'] as const;

export type ParsedExtendRecipientsRequest = {
  ok: true;
  platform: AutomationPlatform;
  orderId: string;
  recipientCount: number;
};

export type InvalidExtendRecipientsRequest = {
  ok: false;
  error: string;
};

export function parseExtendRecipientsRequest(
  body: unknown
): ParsedExtendRecipientsRequest | InvalidExtendRecipientsRequest {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'request body must be a JSON object' };
  }
  const record = body as Record<string, unknown>;
  const extra = Object.keys(record).filter(
    (key) => !(ALLOWED_KEYS as readonly string[]).includes(key)
  );
  if (extra.length > 0) {
    return { ok: false, error: 'unexpected fields in request body' };
  }
  const platformRaw = record.platform;
  if (typeof platformRaw !== 'string' || !platformRaw.trim()) {
    return { ok: false, error: 'platform is required' };
  }
  const platform = platformRaw.trim();
  if (!isAutomationPlatform(platform)) {
    return { ok: false, error: 'platform is not allowed' };
  }
  const orderRaw = record.order_id;
  if (typeof orderRaw !== 'string' || !orderRaw.trim()) {
    return { ok: false, error: 'order_id is required' };
  }
  const orderId = orderRaw.trim();
  if (!isValidAutomationOrderId(platform, orderId)) {
    return { ok: false, error: 'malformed order_id' };
  }
  const countValidation = validateIndividualRecipientCount(record.recipient_count);
  if (!countValidation.ok) {
    return { ok: false, error: countValidation.error };
  }
  return { ok: true, platform, orderId, recipientCount: countValidation.count };
}

export type ExtendRecipientsApiResult =
  | { ok: true; httpStatus: 200; body: Record<string, unknown> }
  | { ok: false; httpStatus: 400 | 404 | 409 | 500; body: Record<string, unknown> };

export async function handleExtendRecipients(
  supabase: SupabaseClient,
  parsed: ParsedExtendRecipientsRequest
): Promise<ExtendRecipientsApiResult> {
  const result = await extendIndividualRecipients(supabase, {
    platform: parsed.platform,
    externalOrderId: parsed.orderId,
    recipientCount: parsed.recipientCount,
  });
  if (!result.ok) {
    return { ok: false, httpStatus: statusFor(result), body: bodyFor(result) };
  }
  const response = buildIndividualInternalCardResponse({
    status: 'existing',
    platform: parsed.platform,
    orderId: parsed.orderId,
    card: result.card,
    recipients: result.recipients,
  });
  return {
    ok: true,
    httpStatus: 200,
    body: {
      ...response,
      status: result.status,
      added_numbers: result.addedNumbers,
    },
  };
}

function statusFor(result: Extract<ExtendIndividualRecipientsResult, { ok: false }>): 400 | 404 | 409 | 500 {
  if (result.code === EXTENSION_ERROR.SET_NOT_FOUND) return 404;
  if (
    result.code === EXTENSION_ERROR.CARD_MODE_MISMATCH ||
    result.code === EXTENSION_ERROR.RECIPIENT_COUNT_DECREASE_REJECTED ||
    result.code === EXTENSION_ERROR.EXTENSION_CONFLICT
  ) {
    return 409;
  }
  if (result.code === EXTENSION_ERROR.INVALID_RECIPIENT_COUNT) return 400;
  return 500;
}

function bodyFor(result: Extract<ExtendIndividualRecipientsResult, { ok: false }>): Record<string, unknown> {
  return {
    error: result.code,
    message: result.message,
    existing_count: result.existingCount,
    requested_count: result.requestedCount,
    added_numbers: result.addedNumbers ?? [],
  };
}
