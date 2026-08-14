import type { CardWithOrder } from './types';

/** Canonical platform value exposed to Mac automation for Admin-created cards. */
export const ADMIN_AUTOMATION_PLATFORM = 'admin';

export const CREATION_SOURCES = ['automation', 'admin'] as const;
export type CreationSource = (typeof CREATION_SOURCES)[number];

export const AUTOMATION_SYNC_STATUSES = [
  'not_required',
  'pending',
  'claimed',
  'ready',
  'failed',
] as const;
export type AutomationSyncStatus = (typeof AUTOMATION_SYNC_STATUSES)[number];

/**
 * Direct queue statuses (pending GET also includes stale `claimed` via timeout).
 */
export const MAC_AUTOMATION_QUEUE_STATUSES: AutomationSyncStatus[] = ['pending', 'failed'];

/**
 * How long a Mac claim may remain exclusive before the server re-queues it.
 * Normal handoff finishes well under this; temporary slow runs should not thrash.
 * Staleness is decided only on the server (Mac must not compute expiry).
 */
export const AUTOMATION_CLAIM_TIMEOUT_MINUTES = 30;

export type CardAutomationMetadata = {
  creationSource: CreationSource;
  automationSyncStatus: AutomationSyncStatus;
  /** When true, persist platform=admin without external_order_id (avoids Shopee identity collision). */
  persistAdminPlatform?: boolean;
};

export function isAutomationSyncStatus(value: string): value is AutomationSyncStatus {
  return (AUTOMATION_SYNC_STATUSES as readonly string[]).includes(value);
}

export function isMacAutomationQueueStatus(status: AutomationSyncStatus): boolean {
  return MAC_AUTOMATION_QUEUE_STATUSES.includes(status);
}

export function automationClaimStaleCutoff(now: Date = new Date()): Date {
  return new Date(now.getTime() - AUTOMATION_CLAIM_TIMEOUT_MINUTES * 60 * 1000);
}

export function isStaleAutomationClaim(
  card: Pick<CardWithOrder, 'automation_sync_status' | 'automation_claimed_at'>,
  now: Date = new Date()
): boolean {
  if ((card.automation_sync_status ?? 'not_required') !== 'claimed') {
    return false;
  }
  const claimedAt = card.automation_claimed_at;
  if (!claimedAt) {
    // Missing timestamp: treat as stale so crash recovery cannot wedge forever.
    return true;
  }
  const claimedMs = Date.parse(claimedAt);
  if (Number.isNaN(claimedMs)) {
    return true;
  }
  return claimedMs < automationClaimStaleCutoff(now).getTime();
}

/** Whether a card belongs on the Mac pending-automation pull queue right now. */
export function isEligibleForMacAutomationPendingQueue(
  card: Pick<CardWithOrder, 'automation_sync_status' | 'automation_claimed_at'>,
  now: Date = new Date()
): boolean {
  const status = card.automation_sync_status ?? 'not_required';
  if (status === 'pending' || status === 'failed') {
    return true;
  }
  if (status === 'claimed') {
    return isStaleAutomationClaim(card, now);
  }
  return false;
}

/** Strips the buildOrderNumber timestamp suffix when present. */
export function extractAdminOrderLabel(orderNumber: string): string {
  const trimmed = orderNumber.trim();
  const match = trimmed.match(/^(.+)-\d{14}$/);
  return match ? match[1] : trimmed;
}

export function resolveAutomationPlatformForCard(card: CardWithOrder): string {
  if (card.platform === ADMIN_AUTOMATION_PLATFORM || card.creation_source === 'admin') {
    return ADMIN_AUTOMATION_PLATFORM;
  }
  if (card.platform) {
    return card.platform;
  }
  return ADMIN_AUTOMATION_PLATFORM;
}

export function resolveAutomationOrderId(card: CardWithOrder): string {
  if (card.external_order_id) {
    return card.external_order_id;
  }
  const orderNumber = card.order?.order_number ?? '';
  return extractAdminOrderLabel(orderNumber);
}

export function applyAutomationMetadataToInsertRow(
  insertRow: Record<string, unknown>,
  metadata?: CardAutomationMetadata
): void {
  if (!metadata) {
    return;
  }
  insertRow.creation_source = metadata.creationSource;
  insertRow.automation_sync_status = metadata.automationSyncStatus;
  if (metadata.persistAdminPlatform) {
    insertRow.platform = ADMIN_AUTOMATION_PLATFORM;
  }
}

const AUTOMATION_ERROR_MAX_LENGTH = 500;

export function sanitizeAutomationErrorMessage(error: unknown): string {
  const raw =
    typeof error === 'string'
      ? error
      : error instanceof Error
        ? error.message
        : 'Automation failed';
  return raw
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .trim()
    .slice(0, AUTOMATION_ERROR_MAX_LENGTH);
}

export function formatAutomationSyncStatusLabel(status: AutomationSyncStatus | null | undefined): string {
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'claimed':
      return 'Claimed';
    case 'ready':
      return 'Ready';
    case 'failed':
      return 'Failed';
    case 'not_required':
    default:
      return 'Not required';
  }
}

/** Admin UI copy for the current automation sync state (optional stale claim). */
export function formatAutomationSyncStatusDetail(
  card: Pick<CardWithOrder, 'automation_sync_status' | 'automation_claimed_at'>,
  now: Date = new Date()
): string | null {
  const status = card.automation_sync_status ?? 'not_required';
  if (status === 'claimed') {
    if (isStaleAutomationClaim(card, now)) {
      return 'Preparation delayed — waiting for automatic retry';
    }
    return 'Mac mini is preparing this card';
  }
  return null;
}

export function shouldShowAdminAutomationStatus(card: Pick<CardWithOrder, 'creation_source' | 'automation_sync_status'>): boolean {
  return (
    card.creation_source === 'admin' &&
    card.automation_sync_status !== undefined &&
    card.automation_sync_status !== null &&
    card.automation_sync_status !== 'not_required'
  );
}
