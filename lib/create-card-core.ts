import type { SupabaseClient } from '@supabase/supabase-js';
import { applyAutomationMetadataToInsertRow, type CardAutomationMetadata } from './card-automation';
import { generateEditToken, generatePublicToken } from './card-tokens';
import { buildEditPinStorage } from './edit-pin-service';
import { generateEditPin } from './edit-pin';
import { isEditPinEncryptionConfigured } from './edit-pin-crypto';
import type { CardWithOrder } from './types';

export const AUTOMATION_PLATFORMS = ['shopee'] as const;
export type AutomationPlatform = (typeof AUTOMATION_PLATFORMS)[number];

export function isAutomationPlatform(value: string): value is AutomationPlatform {
  return (AUTOMATION_PLATFORMS as readonly string[]).includes(value);
}

export function formatOrderTimestamp(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return (
    String(date.getFullYear()) +
    pad(date.getMonth() + 1) +
    pad(date.getDate()) +
    pad(date.getHours()) +
    pad(date.getMinutes()) +
    pad(date.getSeconds())
  );
}

export function buildOrderNumber(input: string, now: Date = new Date()): string {
  return `${input.trim()}-${formatOrderTimestamp(now)}`;
}

export type CreateCardCoreInput = {
  orderNumberInput: string;
  platform?: string | null;
  externalOrderId?: string | null;
  /** Optional business order timestamp; defaults to now (same as orders.created_at). */
  orderedAt?: string | Date | null;
  automationMetadata?: CardAutomationMetadata;
};

export type CreateCardCoreSuccess = {
  ok: true;
  status: 'created' | 'existing';
  card: CardWithOrder;
};

export type CreateCardCoreFailure = {
  ok: false;
  error: string;
};

export type CreateCardCoreResult = CreateCardCoreSuccess | CreateCardCoreFailure;

export async function findCardByPlatformOrder(
  supabase: SupabaseClient,
  platform: string,
  externalOrderId: string
): Promise<CardWithOrder | null> {
  const { data, error } = await supabase
    .from('digital_cards')
    .select('*, order:orders(*)')
    .eq('platform', platform)
    .eq('external_order_id', externalOrderId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }
  return data as CardWithOrder;
}

/**
 * Shared card creation used by Admin UI and the internal automation API.
 * When platform + external_order_id are set, UNIQUE(platform, external_order_id)
 * makes this idempotent: existing cards are returned, never duplicated.
 */
export async function createCardCore(
  supabase: SupabaseClient,
  input: CreateCardCoreInput
): Promise<CreateCardCoreResult> {
  const orderNumberInput = input.orderNumberInput.trim();
  if (!orderNumberInput) {
    return { ok: false, error: 'order number is required' };
  }

  const platform = (input.platform || '').trim() || null;
  const externalOrderId = (input.externalOrderId || '').trim() || null;

  if (platform && externalOrderId) {
    const existing = await findCardByPlatformOrder(supabase, platform, externalOrderId);
    if (existing) {
      return { ok: true, status: 'existing', card: existing };
    }
  }

  const orderNumber = buildOrderNumber(orderNumberInput);
  let orderedAt = new Date().toISOString();
  if (input.orderedAt instanceof Date) {
    if (Number.isNaN(input.orderedAt.getTime())) {
      return { ok: false, error: 'orderedAt is invalid' };
    }
    orderedAt = input.orderedAt.toISOString();
  } else if (typeof input.orderedAt === 'string' && input.orderedAt.trim()) {
    const parsed = new Date(input.orderedAt);
    if (Number.isNaN(parsed.getTime())) {
      return { ok: false, error: 'orderedAt is invalid' };
    }
    orderedAt = parsed.toISOString();
  }

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      order_number: orderNumber,
      ordered_at: orderedAt,
    })
    .select()
    .single();

  if (orderError || !order) {
    return { ok: false, error: orderError?.message || 'Failed to create order' };
  }

  const maxAttempts = 5;
  let card = null;
  let cardError = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const publicToken = generatePublicToken();
    const editToken = generateEditToken(order.order_number);

    const insertRow: Record<string, unknown> = {
      order_id: order.id,
      public_token: publicToken,
      edit_token: editToken,
    };
    if (isEditPinEncryptionConfigured()) {
      Object.assign(insertRow, buildEditPinStorage(generateEditPin()));
    }
    if (platform && externalOrderId) {
      insertRow.platform = platform;
      insertRow.external_order_id = externalOrderId;
    }
    applyAutomationMetadataToInsertRow(insertRow, input.automationMetadata);

    const result = await supabase.from('digital_cards').insert(insertRow).select().single();

    card = result.data;
    cardError = result.error;

    if (!cardError) {
      break;
    }

    if (cardError.code !== '23505') {
      break;
    }

    if (platform && externalOrderId) {
      const raced = await findCardByPlatformOrder(supabase, platform, externalOrderId);
      if (raced) {
        return { ok: true, status: 'existing', card: raced };
      }
    }
  }

  if (cardError || !card) {
    return { ok: false, error: cardError?.message || 'Failed to create digital card' };
  }

  return {
    ok: true,
    status: 'created',
    card: { ...card, order } as CardWithOrder,
  };
}
