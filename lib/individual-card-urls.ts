import { getCanonicalSiteOrigin } from './internal-card-response';
import type { CardWithOrder, DigitalCardRecipient } from './types';

function normalizeOrigin(siteOrigin?: string): string {
  return (siteOrigin || getCanonicalSiteOrigin()).replace(/\/$/, '');
}

/** Buyer edit URL for the parent Individual or Shared card. */
export function buildBuyerEditUrl(card: Pick<CardWithOrder, 'edit_token'>, siteOrigin?: string): string {
  return `${normalizeOrigin(siteOrigin)}/e/${card.edit_token}`;
}

/**
 * Recipient-facing view URL for Individual mode.
 * Uses the recipient row token only — never the parent compatibility public_token.
 */
export function buildRecipientViewUrl(
  recipient: Pick<DigitalCardRecipient, 'view_token'>,
  siteOrigin?: string
): string {
  return `${normalizeOrigin(siteOrigin)}/g/${recipient.view_token}`;
}
