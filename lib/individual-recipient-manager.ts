import { buildRecipientViewUrl } from './individual-card-urls';
import type { DigitalCardRecipient } from './types';
import { parseSenderLinksFromDb } from './sender-links';

export type RecipientPersonalisationStatus = 'not_started' | 'draft' | 'published';

export type RecipientUiFilter = 'all' | RecipientPersonalisationStatus;

/** Buyer-facing manager filter — Draft is not exposed in the edit page UI. */
export type BuyerFacingRecipientFilter = 'all' | 'published' | 'not_started';

export type BuyerFacingRecipientStatus = 'published' | 'not_started';

export interface IndividualRecipientManagerItem {
  id: string;
  recipient_number: number;
  status: 'draft' | 'published';
  has_message: boolean;
  has_photo: boolean;
  has_sender_links: boolean;
  view_pin_enabled: boolean;
  /** Recipient-facing /g/{view_token} URL when published; never an edit URL. */
  view_url: string | null;
}

export type RecipientStatusCounts = {
  published_count: number;
  draft_count: number;
  not_started_count: number;
  total_count: number;
};

export type BuyerFacingRecipientStatusCounts = {
  published_count: number;
  not_started_count: number;
  total_count: number;
};

export function recipientHasSenderLinks(row: {
  show_sender_links: boolean;
  sender_links: DigitalCardRecipient['sender_links'];
}): boolean {
  if (!row.show_sender_links) return false;
  const links = parseSenderLinksFromDb(row.sender_links);
  if (!links) return false;
  return Object.keys(links).length > 0;
}

export function recipientHasMeaningfulContent(item: IndividualRecipientManagerItem): boolean {
  return (
    item.has_message ||
    item.has_photo ||
    item.has_sender_links ||
    item.view_pin_enabled
  );
}

/**
 * Maps a server-side recipient row to a safe buyer-manager DTO.
 * Strips raw view_token, view_pin_hash, photo_path, message text, and other internal fields.
 * For published gifts, exposes the public recipient View URL (same /g/{token} the recipient uses).
 */
export function toIndividualRecipientManagerItem(
  row: DigitalCardRecipient,
  siteOrigin?: string
): IndividualRecipientManagerItem {
  const status: 'draft' | 'published' = row.status === 'published' ? 'published' : 'draft';
  let view_url: string | null = null;

  if (status === 'published') {
    const token = row.view_token?.trim();
    if (token) {
      view_url = buildRecipientViewUrl({ view_token: token }, siteOrigin);
    } else {
      console.warn('[IndividualRecipientManager] published recipient missing view_token', {
        id: row.id,
        recipient_number: row.recipient_number,
      });
    }
  }

  return {
    id: row.id,
    recipient_number: row.recipient_number,
    status,
    has_message: Boolean(row.message?.trim()),
    has_photo: Boolean(row.photo_media_id || row.photo_path),
    has_sender_links: recipientHasSenderLinks(row),
    view_pin_enabled: Boolean(row.view_pin_enabled),
    view_url,
  };
}

export function getRecipientPersonalisationStatus(
  item: IndividualRecipientManagerItem
): RecipientPersonalisationStatus {
  if (item.status === 'published') {
    return 'published';
  }
  if (recipientHasMeaningfulContent(item)) {
    return 'draft';
  }
  return 'not_started';
}

export function computeRecipientStatusCounts(
  items: IndividualRecipientManagerItem[]
): RecipientStatusCounts {
  let published_count = 0;
  let draft_count = 0;
  let not_started_count = 0;

  for (const item of items) {
    const uiStatus = getRecipientPersonalisationStatus(item);
    if (uiStatus === 'published') published_count += 1;
    else if (uiStatus === 'draft') draft_count += 1;
    else not_started_count += 1;
  }

  return {
    published_count,
    draft_count,
    not_started_count,
    total_count: items.length,
  };
}

export function getPublishedProgressPercent(counts: RecipientStatusCounts): number {
  if (counts.total_count === 0) return 0;
  return Math.round((counts.published_count / counts.total_count) * 100);
}

export function sortRecipientsByNumber(
  items: IndividualRecipientManagerItem[]
): IndividualRecipientManagerItem[] {
  return [...items].sort((a, b) => a.recipient_number - b.recipient_number);
}

export function filterRecipientsByUiStatus(
  items: IndividualRecipientManagerItem[],
  filter: RecipientUiFilter
): IndividualRecipientManagerItem[] {
  if (filter === 'all') return items;
  return items.filter((item) => getRecipientPersonalisationStatus(item) === filter);
}

export function toggleRecipientSelection(
  selectedIds: Set<string>,
  recipientId: string
): Set<string> {
  const next = new Set(selectedIds);
  if (next.has(recipientId)) {
    next.delete(recipientId);
  } else {
    next.add(recipientId);
  }
  return next;
}

export function selectAllRecipientIds(items: IndividualRecipientManagerItem[]): Set<string> {
  return new Set(items.map((item) => item.id));
}

export function clearRecipientSelection(): Set<string> {
  return new Set();
}

export function setSingleRecipientSelection(recipientId: string): Set<string> {
  return new Set([recipientId]);
}

export function getBuyerFacingRecipientStatus(
  item: IndividualRecipientManagerItem
): BuyerFacingRecipientStatus {
  return item.status === 'published' ? 'published' : 'not_started';
}

export function computeBuyerFacingStatusCounts(
  items: IndividualRecipientManagerItem[]
): BuyerFacingRecipientStatusCounts {
  let published_count = 0;
  let not_started_count = 0;

  for (const item of items) {
    if (getBuyerFacingRecipientStatus(item) === 'published') {
      published_count += 1;
    } else {
      not_started_count += 1;
    }
  }

  return {
    published_count,
    not_started_count,
    total_count: items.length,
  };
}

export function filterRecipientsByBuyerStatus(
  items: IndividualRecipientManagerItem[],
  filter: BuyerFacingRecipientFilter
): IndividualRecipientManagerItem[] {
  if (filter === 'all') return items;
  return items.filter((item) => getBuyerFacingRecipientStatus(item) === filter);
}

export function getBatchEditActionLabel(selectedCount: number): string {
  if (selectedCount <= 1) {
    return 'Edit selected eCard →';
  }
  return 'Edit selected eCards →';
}

export function formatSelectedGiftCountLabel(selectedCount: number): string {
  return `${selectedCount} selected`;
}

export type SelectAllToolbarState = 'none' | 'partial' | 'all';

export function getSelectAllToolbarState(
  selectedCount: number,
  totalCount: number
): SelectAllToolbarState {
  if (totalCount <= 0 || selectedCount <= 0) return 'none';
  if (selectedCount >= totalCount) return 'all';
  return 'partial';
}

export function formatSelectAllToolbarLabel(
  state: SelectAllToolbarState,
  selectedCount: number,
  totalCount: number
): string {
  if (state === 'all') return `All ${totalCount} selected`;
  if (state === 'partial') return `${selectedCount} selected`;
  return `Select all ${totalCount}`;
}

/** Buyer-facing gift title, e.g. Gift 01 (keeps Gift #01 for admin/API labels). */
export function formatBuyerFacingGiftTitle(recipientNumber: number): string {
  if (!Number.isInteger(recipientNumber) || recipientNumber <= 0) {
    throw new RangeError('recipient_number must be a positive integer');
  }
  const width = Math.max(2, String(recipientNumber).length);
  return `Gift ${String(recipientNumber).padStart(width, '0')}`;
}

/** Compact numbered badge for gift rows, e.g. 01. */
export function formatBuyerFacingGiftBadge(recipientNumber: number): string {
  if (!Number.isInteger(recipientNumber) || recipientNumber <= 0) {
    throw new RangeError('recipient_number must be a positive integer');
  }
  const width = Math.max(2, String(recipientNumber).length);
  return String(recipientNumber).padStart(width, '0');
}

export function getRecipientRowSubtitle(item: IndividualRecipientManagerItem): string {
  if (getBuyerFacingRecipientStatus(item) === 'published') {
    return 'eCard ready';
  }
  return 'Ready for your message';
}

export function getRecipientRowActionLabel(_item: IndividualRecipientManagerItem): string {
  return 'Edit eCard →';
}

export function getRecipientRowViewLabel(_item?: IndividualRecipientManagerItem): string {
  return 'View eCard';
}

/**
 * Public recipient View URL for a published gift, or null when View must stay disabled.
 * Uses the same ready detection as the "eCard ready" subtitle.
 */
export function getRecipientManagerViewUrl(
  item: IndividualRecipientManagerItem
): string | null {
  if (getBuyerFacingRecipientStatus(item) !== 'published') {
    return null;
  }
  const url = item.view_url?.trim();
  return url || null;
}

/** True when the always-visible View eCard control should be enabled (published + safe URL). */
export function canViewRecipientEcard(item: IndividualRecipientManagerItem): boolean {
  return Boolean(getRecipientManagerViewUrl(item));
}

export function getSelectedRecipientNumbers(
  selectedIds: Set<string>,
  items: IndividualRecipientManagerItem[]
): number[] {
  const byId = new Map(items.map((item) => [item.id, item.recipient_number]));
  return Array.from(selectedIds)
    .map((id) => byId.get(id))
    .filter((value): value is number => value !== undefined)
    .sort((a, b) => a - b);
}

/** Ensures DTO objects do not leak sensitive recipient fields to the client. */
export function assertSafeManagerItem(item: unknown): void {
  if (!item || typeof item !== 'object') return;
  const forbidden = [
    'view_token',
    'view_pin_hash',
    'photo_path',
    'message',
    'digital_card_id',
    'sender_links',
    'edit_token',
  ];
  for (const key of forbidden) {
    if (key in (item as Record<string, unknown>)) {
      throw new Error(`Unsafe manager item field: ${key}`);
    }
  }

  const viewUrl = (item as { view_url?: unknown }).view_url;
  if (typeof viewUrl === 'string' && viewUrl.includes('/e/')) {
    throw new Error('Unsafe manager item field: view_url must not be an edit URL');
  }
}

export function assertSafeManagerItems(items: IndividualRecipientManagerItem[]): void {
  for (const item of items) {
    assertSafeManagerItem(item);
  }
}
