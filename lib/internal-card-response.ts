import { formatRecipientNumber } from './card-recipients';
import { buildBuyerEditUrl, buildRecipientViewUrl } from './individual-card-urls';
import { getConfiguredSiteOrigin } from './site-origin';
import type { CardWithOrder, DigitalCardRecipient } from './types';

export const PRODUCTION_SITE_ORIGIN = 'https://hommly.online';

export function getCanonicalSiteOrigin(): string {
  return getConfiguredSiteOrigin() || PRODUCTION_SITE_ORIGIN;
}

export type SharedInternalCardResponse = {
  status: 'created' | 'existing';
  mode: 'shared';
  platform: string;
  order_id: string;
  card_name: string;
  created_at: string;
  buyer_edit_url: string;
  recipient_view_url: string;
};

export type IndividualInternalCardRecipient = {
  number: number;
  label: string;
  view_url: string;
};

export type IndividualInternalCardResponse = {
  status: 'created' | 'existing';
  mode: 'individual';
  platform: string;
  order_id: string;
  card_name: string;
  created_at: string;
  buyer_edit_url: string;
  recipient_count: number;
  recipients: IndividualInternalCardRecipient[];
};

export type InternalCardResponse = SharedInternalCardResponse | IndividualInternalCardResponse;

function resolveCardTimestamps(card: CardWithOrder): { cardName: string; createdAt: string } {
  const cardName = card.order?.order_number || '';
  const createdAt = card.created_at || card.order?.created_at || new Date().toISOString();
  return { cardName, createdAt };
}

export function buildSharedInternalCardResponse(input: {
  status: 'created' | 'existing';
  platform: string;
  orderId: string;
  card: CardWithOrder;
  siteOrigin?: string;
}): SharedInternalCardResponse {
  const origin = (input.siteOrigin || getCanonicalSiteOrigin()).replace(/\/$/, '');
  const { cardName, createdAt } = resolveCardTimestamps(input.card);
  return {
    status: input.status,
    mode: 'shared',
    platform: input.platform,
    order_id: input.orderId,
    card_name: cardName,
    created_at: createdAt,
    buyer_edit_url: buildBuyerEditUrl(input.card, origin),
    recipient_view_url: `${origin}/g/${input.card.public_token}`,
  };
}

export function buildIndividualInternalCardResponse(input: {
  status: 'created' | 'existing';
  platform: string;
  orderId: string;
  card: CardWithOrder;
  recipients: DigitalCardRecipient[];
  siteOrigin?: string;
}): IndividualInternalCardResponse {
  const origin = input.siteOrigin || getCanonicalSiteOrigin();
  const { cardName, createdAt } = resolveCardTimestamps(input.card);
  const sortedRecipients = [...input.recipients].sort(
    (a, b) => a.recipient_number - b.recipient_number
  );

  return {
    status: input.status,
    mode: 'individual',
    platform: input.platform,
    order_id: input.orderId,
    card_name: cardName,
    created_at: createdAt,
    buyer_edit_url: buildBuyerEditUrl(input.card, origin),
    recipient_count: sortedRecipients.length,
    recipients: sortedRecipients.map((recipient) => ({
      number: recipient.recipient_number,
      label: formatRecipientNumber(recipient.recipient_number),
      view_url: buildRecipientViewUrl(recipient, origin),
    })),
  };
}

/** @deprecated Use buildSharedInternalCardResponse — kept for existing Shared callers/tests. */
export function buildInternalCardResponse(input: {
  status: 'created' | 'existing';
  platform: string;
  orderId: string;
  card: CardWithOrder;
  siteOrigin?: string;
}): SharedInternalCardResponse {
  return buildSharedInternalCardResponse(input);
}
