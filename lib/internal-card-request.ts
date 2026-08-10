import { isAutomationPlatform, type AutomationPlatform } from './create-card-core';

export const SHOPEE_ORDER_ID_RE = /^[A-Za-z0-9]{6,32}$/;

export type ParsedInternalCreateRequest = {
  ok: true;
  platform: AutomationPlatform;
  orderId: string;
};

export type InvalidInternalCreateRequest = {
  ok: false;
  error: string;
};

export function parseInternalCreateCardRequest(
  body: unknown
): ParsedInternalCreateRequest | InvalidInternalCreateRequest {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'request body must be a JSON object' };
  }
  const record = body as Record<string, unknown>;
  const extraKeys = Object.keys(record).filter((key) => key !== 'platform' && key !== 'order_id');
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

  return { ok: true, platform, orderId };
}
