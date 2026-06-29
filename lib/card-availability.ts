import { CardWithOrder } from '@/lib/types';

const PUBLIC_TOKEN_PATTERN = /^[a-f0-9]{64}$/i;

export function isValidPublicToken(token: string): boolean {
  return PUBLIC_TOKEN_PATTERN.test(token);
}

export function isRecipientCardUnavailable(card: CardWithOrder | null): boolean {
  if (!card) return true;
  if (!card.order) return true;
  if (card.status === 'disabled' || card.status === 'expired') return true;
  return false;
}
