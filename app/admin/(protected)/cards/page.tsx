import { getCards } from '@/lib/actions';
import { AdminCardsClient } from '@/components/admin/AdminCardsClient';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function AdminCardsPage() {
  const { cards, individualProgress, error } = await getCards();

  return (
    <><div className="bg-[#fdf8f3] px-6 pt-4"><Link href="/admin" className="text-sm text-stone-500 hover:underline">← Admin Portal</Link></div><AdminCardsClient
      initialCards={cards ?? []}
      initialIndividualProgress={individualProgress ?? {}}
      initialError={error}
    /></>
  );
}
