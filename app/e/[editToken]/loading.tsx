import { Loader2 } from 'lucide-react';

export default function EditCardLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50">
      <Loader2 className="h-6 w-6 animate-spin text-stone-400" aria-label="Loading" />
    </div>
  );
}
