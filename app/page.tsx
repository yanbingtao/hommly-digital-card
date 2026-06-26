import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Gift, ArrowRight } from 'lucide-react';

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-stone-50 px-4">
      <div className="text-center">
        <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-100">
          <Gift className="h-8 w-8 text-rose-500" />
        </div>
        <h1 className="text-3xl font-semibold text-stone-800">Hommly</h1>
        <p className="mt-2 text-sm text-stone-500">Digital Surprise Cards</p>
      </div>

      <div className="mt-10">
        <Link href="/admin/cards">
          <Button className="bg-rose-500 px-6 hover:bg-rose-600">
            Go to Admin
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
