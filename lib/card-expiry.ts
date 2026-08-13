import { addMonths, format, formatDistanceToNow } from 'date-fns';

/** Normal eCard availability window from order date. */
export const CARD_AVAILABILITY_MONTHS = 6;
/** Extra month after effective expiry before hard lifecycle delete. */
export const CARD_CLEANUP_BUFFER_MONTHS = 1;
/** Default hard-delete age from order date when no admin override. */
export const CARD_HARD_DELETE_MONTHS =
  CARD_AVAILABILITY_MONTHS + CARD_CLEANUP_BUFFER_MONTHS;

export type OrderDateFields = {
  ordered_at?: string | null;
  created_at?: string | null;
};

export type CardExpiryFields = {
  status?: string;
  created_at?: string | null;
  first_published_at?: string | null;
  published_at?: string | null;
  expires_at_override?: string | null;
  /** Nested order from CardWithOrder selects. */
  order?: OrderDateFields | null;
  /** Flattened helpers for tests / cleanup rows. */
  ordered_at?: string | null;
  order_created_at?: string | null;
};

function parseDate(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Canonical order date for lifecycle:
 * orders.ordered_at ?? orders.created_at
 *
 * Does NOT use first_published_at or digital_cards.created_at.
 */
export function getOrderDate(card: CardExpiryFields): Date | null {
  return parseDate(
    card.order?.ordered_at ??
      card.ordered_at ??
      card.order?.created_at ??
      card.order_created_at
  );
}

/** @deprecated Prefer getOrderDate — lifecycle start is the order date. */
export function getLifecycleStartAt(card: CardExpiryFields): Date | null {
  return getOrderDate(card);
}

export function getFirstPublishedAt(card: CardExpiryFields): Date | null {
  return parseDate(card.first_published_at ?? card.published_at);
}

export function hasExpiryOverride(card: CardExpiryFields): boolean {
  return Boolean(card.expires_at_override);
}

export function getExpiryOverrideAt(card: CardExpiryFields): Date | null {
  return parseDate(card.expires_at_override);
}

/** Default expiry from order date only (ignores admin override). */
export function getDefaultOrderExpiry(card: CardExpiryFields): Date | null {
  const orderDate = getOrderDate(card);
  if (!orderDate) return null;
  return addMonths(orderDate, CARD_AVAILABILITY_MONTHS);
}

/**
 * Soft availability end.
 * Precedence: explicit admin override ?? order date + 6 calendar months.
 * Applies to draft and published alike. Publishing does not extend this.
 */
export function getEffectiveExpiry(card: CardExpiryFields): Date | null {
  const override = getExpiryOverrideAt(card);
  if (override) return override;
  return getDefaultOrderExpiry(card);
}

export function formatDefaultOrderExpiryDateTime(card: CardExpiryFields): string | null {
  const expiresAt = getDefaultOrderExpiry(card);
  if (!expiresAt) return null;
  return format(expiresAt, 'd MMMM yyyy, h:mm a');
}

/**
 * Hard-delete instant = effective expiry + 1 calendar month buffer.
 * effective expiry already includes admin override when set.
 */
export function getHardDeleteAt(card: CardExpiryFields): Date | null {
  const effective = getEffectiveExpiry(card);
  if (!effective) return null;
  return addMonths(effective, CARD_CLEANUP_BUFFER_MONTHS);
}

export function isCardEligibleForHardDelete(
  card: CardExpiryFields,
  nowMs: number = Date.now()
): boolean {
  const hardDeleteAt = getHardDeleteAt(card);
  if (!hardDeleteAt) return false;
  return nowMs >= hardDeleteAt.getTime();
}

/** Effective expiry for display / badges (drafts included). */
export function getCardExpiresAt(card: CardExpiryFields): Date | null {
  return getEffectiveExpiry(card);
}

export function isCardExpired(card: CardExpiryFields): boolean {
  const expiresAt = getEffectiveExpiry(card);
  if (!expiresAt) return false;
  return Date.now() >= expiresAt.getTime();
}

export function formatCardExpiryDate(card: CardExpiryFields): string | null {
  const expiresAt = getCardExpiresAt(card);
  if (!expiresAt) return null;
  return format(expiresAt, 'd MMMM yyyy');
}

export function formatCardExpiryDateTime(card: CardExpiryFields): string | null {
  const expiresAt = getCardExpiresAt(card);
  if (!expiresAt) return null;
  return format(expiresAt, 'd MMMM yyyy, h:mm a');
}

export function formatOrderDate(card: CardExpiryFields): string | null {
  const orderDate = getOrderDate(card);
  if (!orderDate) return null;
  return format(orderDate, 'd MMMM yyyy');
}

export function formatOrderDateTime(card: CardExpiryFields): string | null {
  const orderDate = getOrderDate(card);
  if (!orderDate) return null;
  return format(orderDate, 'd MMMM yyyy, h:mm a');
}

export function formatStoredExpiryOverride(card: CardExpiryFields): string | null {
  if (!card.expires_at_override) return null;
  const override = new Date(card.expires_at_override);
  if (Number.isNaN(override.getTime())) return null;
  return format(override, 'd MMMM yyyy, h:mm a');
}

export function toDatetimeLocalInputValue(iso: string): string {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatFirstPublishedDateTime(card: CardExpiryFields): string | null {
  const firstPublished = getFirstPublishedAt(card);
  if (!firstPublished) return null;
  return format(firstPublished, 'd MMMM yyyy, h:mm a');
}

export function formatEffectiveExpiryDateTime(card: CardExpiryFields): string | null {
  const expiresAt = getEffectiveExpiry(card);
  if (!expiresAt) return null;
  return format(expiresAt, 'd MMMM yyyy, h:mm a');
}

export function formatCardTimeRemaining(card: CardExpiryFields): string | null {
  const expiresAt = getCardExpiresAt(card);
  if (!expiresAt || isCardExpired(card)) return null;
  return formatDistanceToNow(expiresAt, { addSuffix: false });
}

export function getReactivationExpiryDate(): Date {
  return addMonths(new Date(), CARD_AVAILABILITY_MONTHS);
}
