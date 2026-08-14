import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createIndividualCardCore,
  INDIVIDUAL_ERROR,
} from './create-individual-card-core';
import type { ParsedInternalCreateRequest } from './internal-card-request';
import {
  buildIndividualInternalCardResponse,
  type InternalCardResponse,
} from './internal-card-response';
import { automationApiMetadata } from './card-automation-metadata';

export type InternalCardApiSuccess = {
  ok: true;
  httpStatus: 200 | 201;
  body: InternalCardResponse;
};

export type InternalCardApiFailure = {
  ok: false;
  httpStatus: 400 | 409 | 500;
  body: Record<string, unknown>;
};

export type InternalCardApiResult = InternalCardApiSuccess | InternalCardApiFailure;

export async function handleInternalCreateCard(
  supabase: SupabaseClient,
  parsed: Extract<ParsedInternalCreateRequest, { ok: true }>
): Promise<InternalCardApiResult> {
  const result = await createIndividualCardCore(supabase, {
    orderNumberInput: parsed.orderId,
    recipientCount: parsed.recipientCount,
    platform: parsed.platform,
    externalOrderId: parsed.orderId,
    automationMetadata: automationApiMetadata(),
  });

  if (!result.ok) {
    if (result.code === INDIVIDUAL_ERROR.CARD_MODE_MISMATCH) {
      return {
        ok: false,
        httpStatus: 409,
        body: {
          error: result.code,
          existing_mode: result.existingMode,
          requested_mode: result.requestedMode,
        },
      };
    }

    if (result.code === INDIVIDUAL_ERROR.INDIVIDUAL_RECIPIENT_COUNT_MISMATCH) {
      return {
        ok: false,
        httpStatus: 409,
        body: {
          error: result.code,
          existing_count: result.existing,
          requested_count: result.requested,
        },
      };
    }

    if (result.code === INDIVIDUAL_ERROR.INVALID_RECIPIENT_COUNT) {
      return { ok: false, httpStatus: 400, body: { error: result.message } };
    }

    return { ok: false, httpStatus: 500, body: { error: result.message } };
  }

  const status = result.existing ? 'existing' : 'created';

  return {
    ok: true,
    httpStatus: status === 'created' ? 201 : 200,
    body: buildIndividualInternalCardResponse({
      status,
      platform: parsed.platform,
      orderId: parsed.orderId,
      card: result.card,
      recipients: result.recipients,
    }),
  };
}
