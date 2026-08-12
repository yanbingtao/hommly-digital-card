import type { SupabaseClient } from '@supabase/supabase-js';
import { createCardCore, findCardByPlatformOrder } from './create-card-core';
import {
  createIndividualCardCore,
  INDIVIDUAL_ERROR,
} from './create-individual-card-core';
import type { ParsedInternalCreateRequest } from './internal-card-request';
import {
  buildIndividualInternalCardResponse,
  buildSharedInternalCardResponse,
  type InternalCardResponse,
} from './internal-card-response';

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

function modeMismatchResponse(
  existingMode: string,
  requestedMode: string
): InternalCardApiFailure {
  return {
    ok: false,
    httpStatus: 409,
    body: {
      error: 'CARD_MODE_MISMATCH',
      existing_mode: existingMode,
      requested_mode: requestedMode,
    },
  };
}

export async function handleInternalCreateCard(
  supabase: SupabaseClient,
  parsed: Extract<ParsedInternalCreateRequest, { ok: true }>
): Promise<InternalCardApiResult> {
  if (parsed.mode === 'shared') {
    const existing = await findCardByPlatformOrder(supabase, parsed.platform, parsed.orderId);
    if (existing) {
      const existingMode = existing.card_mode ?? 'shared';
      if (existingMode === 'individual') {
        return modeMismatchResponse('individual', 'shared');
      }
    }

    const result = await createCardCore(supabase, {
      orderNumberInput: parsed.orderId,
      platform: parsed.platform,
      externalOrderId: parsed.orderId,
    });

    if (!result.ok) {
      return { ok: false, httpStatus: 500, body: { error: result.error } };
    }

    return {
      ok: true,
      httpStatus: result.status === 'created' ? 201 : 200,
      body: buildSharedInternalCardResponse({
        status: result.status,
        platform: parsed.platform,
        orderId: parsed.orderId,
        card: result.card,
      }),
    };
  }

  const recipientCount = parsed.recipientCount;
  if (recipientCount === undefined) {
    return { ok: false, httpStatus: 400, body: { error: 'recipient_count is required for individual mode' } };
  }

  const result = await createIndividualCardCore(supabase, {
    orderNumberInput: parsed.orderId,
    recipientCount,
    platform: parsed.platform,
    externalOrderId: parsed.orderId,
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
