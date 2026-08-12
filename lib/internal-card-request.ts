import { isAutomationPlatform, type AutomationPlatform } from './create-card-core';
import { validateIndividualRecipientCount } from './individual-recipient-count';

export const SHOPEE_ORDER_ID_RE = /^[A-Za-z0-9]{6,32}$/;

export const INTERNAL_CARD_MODES = ['shared', 'individual'] as const;
export type InternalCardMode = (typeof INTERNAL_CARD_MODES)[number];

const ALLOWED_REQUEST_KEYS = ['platform', 'order_id', 'mode', 'recipient_count'] as const;

export type ParsedInternalCreateRequest = {
  ok: true;
  platform: AutomationPlatform;
  orderId: string;
  mode: InternalCardMode;
  recipientCount?: number;
};

export type InvalidInternalCreateRequest = {
  ok: false;
  error: string;
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
  let mode: InternalCardMode = 'shared';
  if (modeRaw !== undefined) {
    if (typeof modeRaw !== 'string' || !modeRaw.trim()) {
      return { ok: false, error: 'mode must be shared or individual' };
    }
    const normalizedMode = modeRaw.trim().toLowerCase();
    if (!isInternalCardMode(normalizedMode)) {
      return { ok: false, error: 'mode must be shared or individual' };
    }
    mode = normalizedMode;
  }

  const hasRecipientCount = Object.prototype.hasOwnProperty.call(record, 'recipient_count');

  if (mode === 'shared') {
    if (hasRecipientCount) {
      return { ok: false, error: 'recipient_count is not allowed for shared mode' };
    }
    return { ok: true, platform, orderId, mode };
  }

  if (!hasRecipientCount) {
    return { ok: false, error: 'recipient_count is required for individual mode' };
  }

  const countValidation = validateIndividualRecipientCount(record.recipient_count);
  if (!countValidation.ok) {
    return { ok: false, error: countValidation.error };
  }

  return {
    ok: true,
    platform,
    orderId,
    mode,
    recipientCount: countValidation.count,
  };
}
