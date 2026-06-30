import { Order } from '@/lib/types';
import { CardExpiryFields, isCardExpired } from './card-expiry';

const PUBLIC_TOKEN_PATTERN = /^[a-f0-9]{64}$/i;

export function isValidPublicToken(token: string): boolean {
  return PUBLIC_TOKEN_PATTERN.test(token);
}

export function isRecipientCardUnavailable(
  card: ({ order?: Order | null; status?: string } & CardExpiryFields) | null
): boolean {
  if (!card) return true;
  if (!card.order) return true;
  if (card.status === 'disabled' || card.status === 'expired') return true;
  if (isCardExpired(card)) return true;
  return false;
}
