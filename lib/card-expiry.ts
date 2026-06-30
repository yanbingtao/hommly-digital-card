import { addMonths, format, formatDistanceToNow } from 'date-fns';

export const CARD_AVAILABILITY_MONTHS = 6;

export type CardExpiryFields = {
  status?: string;
  first_published_at?: string | null;
  published_at?: string | null;
  expires_at_override?: string | null;
};

export function getFirstPublishedAt(card: CardExpiryFields): Date | null {
  const raw = card.first_published_at ?? card.published_at;
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function hasExpiryOverride(card: CardExpiryFields): boolean {
  return Boolean(card.expires_at_override);
}

export function getCardExpiresAt(card: CardExpiryFields): Date | null {
  if (card.status !== 'published') return null;

  if (card.expires_at_override) {
    const override = new Date(card.expires_at_override);
    if (!Number.isNaN(override.getTime())) return override;
  }

  const firstPublished = getFirstPublishedAt(card);
  if (!firstPublished) return null;
  return addMonths(firstPublished, CARD_AVAILABILITY_MONTHS);
}

export function isCardExpired(card: CardExpiryFields): boolean {
  const expiresAt = getCardExpiresAt(card);
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
  if (card.status !== 'published') return null;
  const firstPublished = getFirstPublishedAt(card);
  if (!firstPublished) return null;
  return format(firstPublished, 'd MMMM yyyy, h:mm a');
}

export function formatCardTimeRemaining(card: CardExpiryFields): string | null {
  const expiresAt = getCardExpiresAt(card);
  if (!expiresAt || isCardExpired(card)) return null;
  return formatDistanceToNow(expiresAt, { addSuffix: false });
}

export function getReactivationExpiryDate(): Date {
  return addMonths(new Date(), CARD_AVAILABILITY_MONTHS);
}
