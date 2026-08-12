import { formatRecipientNumber } from './card-recipients';
import {
  getRecipientPersonalisationStatus,
  toIndividualRecipientManagerItem,
  type RecipientPersonalisationStatus,
} from './individual-recipient-manager';
import { buildRecipientViewUrl } from './individual-card-urls';
import { validateIndividualRecipientCount } from './individual-recipient-count';
import type { AdminIndividualRecipientItem } from './admin-card-types';
import type { CardWithOrder, DigitalCardRecipient } from './types';

export function validateAdminIndividualRecipientQuantity(
  value: unknown
): { ok: true; count: number } | { ok: false; error: string } {
  const parsed =
    typeof value === 'string' && value.trim() !== '' ? Number(value.trim()) : value;

  const result = validateIndividualRecipientCount(parsed);
  if (!result.ok) {
    return { ok: false, error: 'Please enter a valid gift quantity.' };
  }
  return result;
}

export function formatAdminRecipientStatusLabel(status: RecipientPersonalisationStatus): string {
  switch (status) {
    case 'not_started':
      return 'Not started';
    case 'draft':
      return 'Draft';
    case 'published':
      return 'Published';
  }
}

export function buildAdminIndividualRecipientItems(
  rows: DigitalCardRecipient[],
  siteOrigin: string
): AdminIndividualRecipientItem[] {
  return [...rows]
    .sort((a, b) => a.recipient_number - b.recipient_number)
    .map((row) => {
      const managerItem = toIndividualRecipientManagerItem(row);
      const status = getRecipientPersonalisationStatus(managerItem);
      return {
        recipient_number: row.recipient_number,
        label: formatRecipientNumber(row.recipient_number),
        viewUrl: buildRecipientViewUrl(row, siteOrigin),
        status,
        statusLabel: formatAdminRecipientStatusLabel(status),
      };
    });
}

export function isIndividualCard(card: Pick<CardWithOrder, 'card_mode'>): boolean {
  return card.card_mode === 'individual';
}

export function getAdminCardTypeLabel(
  card: Pick<CardWithOrder, 'card_mode'>,
  recipientCount: number | null | undefined
): string {
  if (!isIndividualCard(card)) {
    return 'Shared';
  }
  const count = recipientCount ?? 0;
  return count === 1 ? 'Individual · 1 Gift' : `Individual · ${count} Gifts`;
}
