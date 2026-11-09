import type { SupabaseClient } from '@supabase/supabase-js';
import { extractAdminOrderLabel } from './card-automation';
import { getRecipientsForCard } from './card-recipients';
import { findCardByPlatformOrder } from './create-card-core';
import { isValidAutomationOrderId } from './internal-card-request';
import { buildIndividualInternalCardResponse } from './internal-card-response';
import type { CardWithOrder } from './types';

export const MANUAL_LOOKUP_PLATFORMS = ['shopee', 'shopify', 'admin'] as const;
export type ManualLookupPlatform = (typeof MANUAL_LOOKUP_PLATFORMS)[number];

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ADMIN_SET_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,80}$/;

export type ManualLookupSuccess = {
  ok: true;
  httpStatus: 200;
  body: ReturnType<typeof buildIndividualInternalCardResponse> & { card_id: string };
};

export type ManualLookupFailure = {
  ok: false;
  httpStatus: 400 | 404 | 409;
  error: string;
};

export type ManualLookupResult = ManualLookupSuccess | ManualLookupFailure;

export function parseManualLookupQuery(searchParams: URLSearchParams): {
  ok: true;
  platform: ManualLookupPlatform;
  orderId: string;
} | ManualLookupFailure {
  const platform = (searchParams.get('platform') ?? '').trim().toLowerCase();
  const orderId = (searchParams.get('order_id') ?? '').trim();
  if (!MANUAL_LOOKUP_PLATFORMS.includes(platform as ManualLookupPlatform)) {
    return { ok: false, httpStatus: 400, error: 'platform is not allowed' };
  }
  if (!orderId) {
    return { ok: false, httpStatus: 400, error: 'order_id is required' };
  }
  if (platform === 'admin') {
    if (!UUID_RE.test(orderId) && !ADMIN_SET_ID_RE.test(orderId)) {
      return { ok: false, httpStatus: 400, error: 'malformed order_id' };
    }
  } else if (!isValidAutomationOrderId(platform, orderId)) {
    return { ok: false, httpStatus: 400, error: 'malformed order_id' };
  }
  return { ok: true, platform: platform as ManualLookupPlatform, orderId };
}

function isAdminIndividual(card: CardWithOrder): boolean {
  return card.creation_source === 'admin' && (card.card_mode ?? 'shared') === 'individual';
}

export function chooseAdminCard(
  cards: CardWithOrder[],
  orderId: string
): { ok: true; card: CardWithOrder } | ManualLookupFailure {
  const individual = cards.filter(isAdminIndividual);
  if (UUID_RE.test(orderId)) {
    const match = individual.find((card) => card.id === orderId);
    if (!match) {
      return { ok: false, httpStatus: 404, error: 'set not found' };
    }
    return { ok: true, card: match };
  }
  const exact = individual.filter((card) => (card.order?.order_number || '') === orderId);
  if (exact.length === 1) {
    return { ok: true, card: exact[0] };
  }
  if (exact.length > 1) {
    return { ok: false, httpStatus: 409, error: 'ambiguous set id' };
  }
  const labeled = individual.filter(
    (card) => extractAdminOrderLabel(card.order?.order_number || '') === orderId
  );
  if (labeled.length === 1) {
    return { ok: true, card: labeled[0] };
  }
  if (labeled.length > 1) {
    return { ok: false, httpStatus: 409, error: 'ambiguous set id' };
  }
  return { ok: false, httpStatus: 404, error: 'set not found' };
}

function localOrderId(card: CardWithOrder): string {
  const orderNumber = (card.order?.order_number || '').trim();
  if (ADMIN_SET_ID_RE.test(orderNumber)) {
    return orderNumber;
  }
  const label = extractAdminOrderLabel(orderNumber);
  if (ADMIN_SET_ID_RE.test(label)) {
    return label;
  }
  return card.id;
}

async function payloadFor(
  supabase: SupabaseClient,
  card: CardWithOrder,
  platform: string,
  orderId: string
): Promise<ManualLookupResult> {
  if ((card.card_mode ?? 'shared') !== 'individual') {
    return { ok: false, httpStatus: 404, error: 'set not found' };
  }
  const loaded = await getRecipientsForCard(supabase, card.id);
  if (loaded.error) {
    return { ok: false, httpStatus: 404, error: 'set not found' };
  }
  return {
    ok: true,
    httpStatus: 200,
    body: {
      ...buildIndividualInternalCardResponse({
        status: 'existing',
        platform,
        orderId,
        card,
        recipients: loaded.recipients,
      }),
      card_id: card.id,
    },
  };
}

export async function lookupExistingCard(
  supabase: SupabaseClient,
  platform: ManualLookupPlatform,
  orderId: string
): Promise<ManualLookupResult> {
  if (platform === 'admin') {
    const cards = await loadAdminCandidates(supabase, orderId);
    if (!cards.ok) {
      return cards;
    }
    const chosen = chooseAdminCard(cards.cards, orderId);
    if (!chosen.ok) {
      return chosen;
    }
    return payloadFor(supabase, chosen.card, 'admin', localOrderId(chosen.card));
  }

  const card = await findCardByPlatformOrder(supabase, platform, orderId);
  if (!card) {
    return { ok: false, httpStatus: 404, error: 'set not found' };
  }
  return payloadFor(supabase, card, platform, orderId);
}

async function loadAdminCandidates(
  supabase: SupabaseClient,
  orderId: string
): Promise<{ ok: true; cards: CardWithOrder[] } | ManualLookupFailure> {
  if (UUID_RE.test(orderId)) {
    const { data, error } = await supabase
      .from('digital_cards')
      .select('*, order:orders(*)')
      .eq('id', orderId)
      .maybeSingle();
    if (error || !data) {
      return { ok: false, httpStatus: 404, error: 'set not found' };
    }
    return { ok: true, cards: [data as CardWithOrder] };
  }
  const exact = await supabase.from('orders').select('id, order_number').eq('order_number', orderId);
  const prefixed = await supabase
    .from('orders')
    .select('id, order_number')
    .like('order_number', `${orderId}-%`);
  if (exact.error || prefixed.error) {
    return { ok: false, httpStatus: 404, error: 'set not found' };
  }
  const orderIds = [
    ...new Set(
      [...(exact.data ?? []), ...(prefixed.data ?? [])]
        .map((row) => String((row as { id?: string }).id || ''))
        .filter(Boolean)
    ),
  ];
  if (orderIds.length === 0) {
    return { ok: true, cards: [] };
  }
  const { data, error } = await supabase
    .from('digital_cards')
    .select('*, order:orders(*)')
    .in('order_id', orderIds)
    .eq('creation_source', 'admin');
  if (error) {
    return { ok: false, httpStatus: 404, error: 'set not found' };
  }
  return { ok: true, cards: (data ?? []) as CardWithOrder[] };
}
