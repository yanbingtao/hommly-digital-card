import type { SupabaseClient } from '@supabase/supabase-js';
import { isAutomationPlatform, type AutomationPlatform } from './create-card-core';
import { isValidEditPin } from './edit-pin';
import { decryptEditPin, isEditPinEncryptionConfigured } from './edit-pin-crypto';
import { SHOPEE_ORDER_ID_RE } from './internal-card-request';
import type { CardMode } from './types';

export const EDIT_PIN_LOOKUP_ERROR = {
  INVALID_PLATFORM: 'INVALID_PLATFORM',
  INVALID_ORDER_ID: 'INVALID_ORDER_ID',
  CARD_NOT_FOUND: 'CARD_NOT_FOUND',
  SHARED_CARD_NOT_SUPPORTED: 'SHARED_CARD_NOT_SUPPORTED',
  EDIT_PIN_NOT_CONFIGURED: 'EDIT_PIN_NOT_CONFIGURED',
  EDIT_PIN_NOT_AVAILABLE: 'EDIT_PIN_NOT_AVAILABLE',
  EDIT_PIN_DECRYPT_FAILED: 'EDIT_PIN_DECRYPT_FAILED',
  EDIT_PIN_INVALID: 'EDIT_PIN_INVALID',
  LOOKUP_QUERY_FAILED: 'LOOKUP_QUERY_FAILED',
} as const;

export type EditPinLookupErrorCode =
  (typeof EDIT_PIN_LOOKUP_ERROR)[keyof typeof EDIT_PIN_LOOKUP_ERROR];

export type EditPinLookupSuccess = {
  ok: true;
  platform: AutomationPlatform;
  order_id: string;
  card_name: string;
  edit_pin: string;
  /** Short id for safe server logs only — never returned in HTTP body. */
  cardId: string;
  /** Canonical vs legacy order_number prefix recovery. */
  matchPath: 'canonical' | 'legacy_order_number_prefix';
};

export type EditPinLookupFailure = {
  ok: false;
  code: EditPinLookupErrorCode;
  message: string;
  httpStatus: number;
  /** Short id when a card was found but rejected — never returned in HTTP body. */
  cardId?: string;
};

export type EditPinLookupResult = EditPinLookupSuccess | EditPinLookupFailure;

export type EditPinLookupResponseBody = {
  platform: AutomationPlatform;
  order_id: string;
  card_name: string;
  edit_pin: string;
};

type LookupCardRow = {
  id: string;
  platform: string | null;
  external_order_id: string | null;
  card_mode: CardMode | null;
  creation_source?: string | null;
  edit_pin_encrypted: string | null;
  order: { order_number: string } | { order_number: string }[] | null;
};

const LOOKUP_SELECT =
  'id, platform, external_order_id, card_mode, creation_source, edit_pin_encrypted, order:orders(order_number)';

export function parseEditPinLookupQuery(searchParams: URLSearchParams):
  | { ok: true; platform: AutomationPlatform; orderId: string }
  | { ok: false; code: EditPinLookupErrorCode; message: string; httpStatus: number } {
  const platformRaw = (searchParams.get('platform') ?? '').trim();
  if (!platformRaw) {
    return {
      ok: false,
      code: EDIT_PIN_LOOKUP_ERROR.INVALID_PLATFORM,
      message: 'platform is required',
      httpStatus: 400,
    };
  }
  if (!isAutomationPlatform(platformRaw)) {
    return {
      ok: false,
      code: EDIT_PIN_LOOKUP_ERROR.INVALID_PLATFORM,
      message: 'platform is not allowed',
      httpStatus: 400,
    };
  }

  const orderId = (searchParams.get('order_id') ?? '').trim();
  if (!orderId) {
    return {
      ok: false,
      code: EDIT_PIN_LOOKUP_ERROR.INVALID_ORDER_ID,
      message: 'order_id is required',
      httpStatus: 400,
    };
  }
  if (!SHOPEE_ORDER_ID_RE.test(orderId)) {
    return {
      ok: false,
      code: EDIT_PIN_LOOKUP_ERROR.INVALID_ORDER_ID,
      message: 'malformed order_id',
      httpStatus: 400,
    };
  }

  return { ok: true, platform: platformRaw, orderId };
}

export function resolveOrderNumber(order: LookupCardRow['order']): string {
  if (!order) return '';
  if (Array.isArray(order)) {
    return order[0]?.order_number?.trim() || '';
  }
  return order.order_number?.trim() || '';
}

/** Exact legacy card_name / order_number prefix: `<ORDER_ID>-…`. */
export function orderNumberMatchesShopeePrefix(orderNumber: string, orderId: string): boolean {
  const on = orderNumber.trim();
  const oid = orderId.trim();
  if (!on || !oid) return false;
  return on.startsWith(`${oid}-`);
}

/**
 * Legacy recovery eligibility (read-only).
 * Excludes Admin cards; requires Individual; platform must be shopee or unset.
 */
export function isLegacyShopeeIndividualCandidate(
  card: Pick<LookupCardRow, 'platform' | 'creation_source' | 'card_mode'>,
  orderNumber: string,
  orderId: string
): boolean {
  const mode: CardMode = card.card_mode ?? 'shared';
  if (mode !== 'individual') return false;
  if ((card.creation_source || '').trim() === 'admin') return false;
  const platform = (card.platform || '').trim();
  if (platform === 'admin') return false;
  if (platform && platform !== 'shopee') return false;
  return orderNumberMatchesShopeePrefix(orderNumber, orderId);
}

async function findCanonicalCard(
  supabase: SupabaseClient,
  platform: AutomationPlatform,
  orderId: string
): Promise<{ card: LookupCardRow | null; error: string | null }> {
  const { data, error } = await supabase
    .from('digital_cards')
    .select(LOOKUP_SELECT)
    .eq('platform', platform)
    .eq('external_order_id', orderId)
    .maybeSingle();

  if (error) {
    return { card: null, error: error.message || 'canonical lookup failed' };
  }
  return { card: (data as LookupCardRow | null) ?? null, error: null };
}

/**
 * Legacy recovery only: when canonical platform+external_order_id is absent.
 * Matches exact order_number prefix `<ORDER_ID>-`, Individual, non-Admin.
 * Requires exactly one match — never picks newest among many.
 */
async function findLegacyCardByOrderNumberPrefix(
  supabase: SupabaseClient,
  orderId: string
): Promise<{ card: LookupCardRow | null; error: string | null; ambiguous: boolean }> {
  const { data: orders, error: orderError } = await supabase
    .from('orders')
    .select('id, order_number')
    .like('order_number', `${orderId}-%`);

  if (orderError) {
    return {
      card: null,
      error: orderError.message || 'legacy order lookup failed',
      ambiguous: false,
    };
  }

  const orderRows = (orders || []) as { id: string; order_number: string }[];
  const orderIds = orderRows
    .filter((row) => orderNumberMatchesShopeePrefix(row.order_number || '', orderId))
    .map((row) => row.id);

  if (orderIds.length === 0) {
    return { card: null, error: null, ambiguous: false };
  }

  const { data: cards, error: cardError } = await supabase
    .from('digital_cards')
    .select(LOOKUP_SELECT)
    .in('order_id', orderIds)
    .eq('card_mode', 'individual');

  if (cardError) {
    return {
      card: null,
      error: cardError.message || 'legacy card lookup failed',
      ambiguous: false,
    };
  }

  const matches = ((cards || []) as LookupCardRow[]).filter((card) => {
    const orderNumber = resolveOrderNumber(card.order);
    return isLegacyShopeeIndividualCandidate(card, orderNumber, orderId);
  });

  if (matches.length === 0) {
    return { card: null, error: null, ambiguous: false };
  }
  if (matches.length > 1) {
    return { card: null, error: null, ambiguous: true };
  }
  return { card: matches[0], error: null, ambiguous: false };
}

function decryptExistingPin(card: LookupCardRow): EditPinLookupResult {
  const shortId = card.id.slice(0, 8);
  const mode: CardMode = card.card_mode ?? 'shared';

  if (mode !== 'individual') {
    return {
      ok: false,
      code: EDIT_PIN_LOOKUP_ERROR.SHARED_CARD_NOT_SUPPORTED,
      message: 'Edit PIN lookup supports Individual cards only',
      httpStatus: 409,
      cardId: shortId,
    };
  }

  const encrypted = card.edit_pin_encrypted?.trim() || '';
  if (!encrypted) {
    return {
      ok: false,
      code: EDIT_PIN_LOOKUP_ERROR.EDIT_PIN_NOT_AVAILABLE,
      message: 'Edit PIN is not available for this card',
      httpStatus: 422,
      cardId: shortId,
    };
  }

  let pin: string;
  try {
    pin = decryptEditPin(encrypted);
  } catch {
    return {
      ok: false,
      code: EDIT_PIN_LOOKUP_ERROR.EDIT_PIN_DECRYPT_FAILED,
      message: 'Failed to recover Edit PIN',
      httpStatus: 422,
      cardId: shortId,
    };
  }

  if (!isValidEditPin(pin)) {
    return {
      ok: false,
      code: EDIT_PIN_LOOKUP_ERROR.EDIT_PIN_INVALID,
      message: 'Recovered Edit PIN is invalid',
      httpStatus: 422,
      cardId: shortId,
    };
  }

  return {
    ok: true,
    platform: 'shopee',
    order_id: '',
    card_name: resolveOrderNumber(card.order),
    edit_pin: pin,
    cardId: shortId,
    matchPath: 'canonical',
  };
}

/**
 * Read-only Edit PIN lookup for Mac automation.
 * Decrypts the existing AES ciphertext only — never generates or rotates a PIN.
 *
 * Identity:
 * 1. Canonical: platform + external_order_id
 * 2. Legacy recovery only: exact orders.order_number prefix `<ORDER_ID>-`
 *    for Individual non-Admin cards when (1) misses — requires exactly one match
 */
export async function lookupEditPinByPlatformOrder(
  supabase: SupabaseClient,
  platform: AutomationPlatform,
  orderId: string
): Promise<EditPinLookupResult> {
  if (!isEditPinEncryptionConfigured()) {
    return {
      ok: false,
      code: EDIT_PIN_LOOKUP_ERROR.EDIT_PIN_NOT_CONFIGURED,
      message: 'Edit PIN encryption is not configured',
      httpStatus: 503,
    };
  }

  const canonical = await findCanonicalCard(supabase, platform, orderId);
  if (canonical.error) {
    return {
      ok: false,
      code: EDIT_PIN_LOOKUP_ERROR.LOOKUP_QUERY_FAILED,
      message: 'Edit PIN lookup query failed',
      httpStatus: 503,
    };
  }

  let card = canonical.card;
  let matchPath: EditPinLookupSuccess['matchPath'] = 'canonical';

  if (!card) {
    const legacy = await findLegacyCardByOrderNumberPrefix(supabase, orderId);
    if (legacy.error) {
      return {
        ok: false,
        code: EDIT_PIN_LOOKUP_ERROR.LOOKUP_QUERY_FAILED,
        message: 'Edit PIN lookup query failed',
        httpStatus: 503,
      };
    }
    if (legacy.ambiguous) {
      return {
        ok: false,
        code: EDIT_PIN_LOOKUP_ERROR.CARD_NOT_FOUND,
        message: 'Card not found',
        httpStatus: 404,
      };
    }
    if (legacy.card) {
      card = legacy.card;
      matchPath = 'legacy_order_number_prefix';
    }
  }

  if (!card) {
    return {
      ok: false,
      code: EDIT_PIN_LOOKUP_ERROR.CARD_NOT_FOUND,
      message: 'Card not found',
      httpStatus: 404,
    };
  }

  const decrypted = decryptExistingPin(card);
  if (!decrypted.ok) {
    return decrypted;
  }

  return {
    ...decrypted,
    platform,
    order_id: orderId,
    matchPath,
  };
}

export function buildEditPinLookupResponseBody(
  result: EditPinLookupSuccess
): EditPinLookupResponseBody {
  return {
    platform: result.platform,
    order_id: result.order_id,
    card_name: result.card_name,
    edit_pin: result.edit_pin,
  };
}

/** Safe server log fields — never includes edit_pin or tokens. */
export function buildEditPinLookupLogFields(
  result: EditPinLookupResult,
  platform: string,
  orderId: string
): Record<string, string | boolean> {
  if (result.ok) {
    return {
      platform,
      order_id: orderId,
      card_id: result.cardId,
      ok: true,
      match_path: result.matchPath,
    };
  }
  return {
    platform,
    order_id: orderId,
    card_id: result.cardId ?? '',
    ok: false,
    code: result.code,
  };
}
