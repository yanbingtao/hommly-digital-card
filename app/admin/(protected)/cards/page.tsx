import { getCards } from '@/lib/actions';
import { AdminCardsClient } from '@/components/admin/AdminCardsClient';

export const dynamic = 'force-dynamic';

export default async function AdminCardsPage() {
  const { cards, individualProgress, error } = await getCards();

  return (
    <AdminCardsClient
      initialCards={cards ?? []}
      initialIndividualProgress={individualProgress ?? {}}
      initialError={error}
    />
  );
}
