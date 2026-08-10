import { Order } from '@/lib/types';
import { CardExpiryFields, isCardExpired } from './card-expiry';
export { isValidPublicToken } from './card-tokens';

export function isRecipientCardUnavailable(
  card: ({ order?: Order | null; status?: string } & CardExpiryFields) | null
): boolean {
  if (!card) return true;
  if (!card.order) return true;
  if (card.status === 'disabled' || card.status === 'expired') return true;
  if (isCardExpired(card)) return true;
  return false;
}
