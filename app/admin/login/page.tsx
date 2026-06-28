import { Suspense } from 'react';
import { AdminLoginForm } from '@/components/admin/AdminLoginForm';
import { Loader2 } from 'lucide-react';

export default function AdminLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#fdf8f3]">
          <Loader2 className="h-6 w-6 animate-spin text-stone-400" />
        </div>
      }
    >
      <AdminLoginForm />
    </Suspense>
  );
}
