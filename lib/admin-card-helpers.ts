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

/** Aggregated individual-card progress for Admin list/details (derived, not a DB enum). */
export type AdminIndividualCardProgress = {
  total_gifts: number;
  published_gifts: number;
  /** Published gifts with a recipient view_token (public /g/ links). */
  recipient_view_links: number;
};

export type AdminIndividualDisplayStatus = 'draft' | 'in_progress' | 'ready';

export type AdminRecipientProgressRow = {
  digital_card_id: string;
  status: string | null;
  view_token: string | null;
};

export function emptyAdminIndividualCardProgress(): AdminIndividualCardProgress {
  return { total_gifts: 0, published_gifts: 0, recipient_view_links: 0 };
}

export function aggregateAdminIndividualCardProgress(
  rows: AdminRecipientProgressRow[]
): Record<string, AdminIndividualCardProgress> {
  const progress: Record<string, AdminIndividualCardProgress> = {};

  for (const row of rows) {
    const cardId = row.digital_card_id;
    if (!cardId) continue;
    const current = progress[cardId] ?? emptyAdminIndividualCardProgress();
    current.total_gifts += 1;
    const published = row.status === 'published';
    if (published) {
      current.published_gifts += 1;
      if (row.view_token?.trim()) {
        current.recipient_view_links += 1;
      }
    }
    progress[cardId] = current;
  }

  return progress;
}

export function getAdminIndividualDisplayStatus(
  progress: Pick<AdminIndividualCardProgress, 'total_gifts' | 'published_gifts'>
): AdminIndividualDisplayStatus {
  if (progress.published_gifts <= 0) return 'draft';
  if (progress.total_gifts > 0 && progress.published_gifts >= progress.total_gifts) {
    return 'ready';
  }
  return 'in_progress';
}

export function formatAdminIndividualReadySummary(
  progress: Pick<AdminIndividualCardProgress, 'total_gifts' | 'published_gifts'>
): string {
  return `${progress.published_gifts} of ${progress.total_gifts} eCards ready`;
}

export function formatAdminRecipientViewLinksLabel(count: number): string {
  return count === 1
    ? '1 recipient view link in card details'
    : `${count} recipient view links in card details`;
}

export function getAdminIndividualDisplayStatusLabel(
  status: AdminIndividualDisplayStatus
): string {
  switch (status) {
    case 'draft':
      return 'Draft';
    case 'in_progress':
      return 'In progress';
    case 'ready':
      return 'Ready';
  }
}

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
