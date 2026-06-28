import { getCards } from '@/lib/actions';
import { AdminCardsClient } from '@/components/admin/AdminCardsClient';

export const dynamic = 'force-dynamic';

export default async function AdminCardsPage() {
  const { cards, error } = await getCards();

  return <AdminCardsClient initialCards={cards ?? []} initialError={error} />;
}
