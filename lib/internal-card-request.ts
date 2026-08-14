import { isAutomationPlatform, type AutomationPlatform } from './create-card-core';
import { validateIndividualRecipientCount } from './individual-recipient-count';

export const SHOPEE_ORDER_ID_RE = /^[A-Za-z0-9]{6,32}$/;

export const SHARED_CARD_CREATION_DISABLED = 'SHARED_CARD_CREATION_DISABLED';

export const INTERNAL_CARD_MODES = ['shared', 'individual'] as const;
export type InternalCardMode = (typeof INTERNAL_CARD_MODES)[number];

const ALLOWED_REQUEST_KEYS = ['platform', 'order_id', 'mode', 'recipient_count'] as const;

export type ParsedInternalCreateRequest = {
  ok: true;
  platform: AutomationPlatform;
  orderId: string;
  mode: 'individual';
  recipientCount: number;
};

export type InvalidInternalCreateRequest = {
  ok: false;
  error: string;
  code?: typeof SHARED_CARD_CREATION_DISABLED;
};

function isInternalCardMode(value: string): value is InternalCardMode {
  return (INTERNAL_CARD_MODES as readonly string[]).includes(value);
}

export function parseInternalCreateCardRequest(
  body: unknown
): ParsedInternalCreateRequest | InvalidInternalCreateRequest {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'request body must be a JSON object' };
  }
  const record = body as Record<string, unknown>;
  const extraKeys = Object.keys(record).filter(
    (key) => !(ALLOWED_REQUEST_KEYS as readonly string[]).includes(key)
  );
  if (extraKeys.length > 0) {
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
  if (!SHOPEE_ORDER_ID_RE.test(orderId)) {
    return { ok: false, error: 'malformed order_id' };
  }

  const modeRaw = record.mode;
  if (modeRaw !== undefined) {
    if (typeof modeRaw !== 'string' || !modeRaw.trim()) {
      return { ok: false, error: 'mode must be individual' };
    }
    const normalizedMode = modeRaw.trim().toLowerCase();
    if (normalizedMode === 'shared') {
      return {
        ok: false,
        error: 'Shared card creation is disabled; recipient_count is required for Individual cards',
        code: SHARED_CARD_CREATION_DISABLED,
      };
    }
    if (normalizedMode !== 'individual') {
      return { ok: false, error: 'mode must be individual' };
    }
  }

  const hasRecipientCount = Object.prototype.hasOwnProperty.call(record, 'recipient_count');
  if (!hasRecipientCount) {
    return {
      ok: false,
      error: 'recipient_count is required for Individual card creation',
    };
  }

  const countValidation = validateIndividualRecipientCount(record.recipient_count);
  if (!countValidation.ok) {
    return { ok: false, error: countValidation.error };
  }

  return {
    ok: true,
    platform,
    orderId,
    mode: 'individual',
    recipientCount: countValidation.count,
  };
}
