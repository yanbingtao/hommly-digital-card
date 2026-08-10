import { getConfiguredSiteOrigin } from './site-origin';
import type { CardWithOrder } from './types';

export const PRODUCTION_SITE_ORIGIN = 'https://hommly.online';

export function getCanonicalSiteOrigin(): string {
  return getConfiguredSiteOrigin() || PRODUCTION_SITE_ORIGIN;
}

export type InternalCardResponse = {
  status: 'created' | 'existing';
  platform: string;
  order_id: string;
  card_name: string;
  created_at: string;
  buyer_edit_url: string;
  recipient_view_url: string;
};

export function buildInternalCardResponse(input: {
  status: 'created' | 'existing';
  platform: string;
  orderId: string;
  card: CardWithOrder;
  siteOrigin?: string;
}): InternalCardResponse {
  const origin = (input.siteOrigin || getCanonicalSiteOrigin()).replace(/\/$/, '');
  const cardName = input.card.order?.order_number || '';
  const createdAt =
    input.card.created_at || input.card.order?.created_at || new Date().toISOString();
  return {
    status: input.status,
    platform: input.platform,
    order_id: input.orderId,
    card_name: cardName,
    created_at: createdAt,
    buyer_edit_url: `${origin}/e/${input.card.edit_token}`,
    recipient_view_url: `${origin}/g/${input.card.public_token}`,
  };
}
