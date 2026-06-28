'use client';

import { useTransition } from 'react';
import { logoutAdmin } from '@/app/actions/admin-auth';
import { Button } from '@/components/ui/button';
import { Loader2, LogOut } from 'lucide-react';

export function AdminLogoutButton() {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await logoutAdmin();
          window.location.assign('/admin/login');
        })
      }
    >
      {isPending ? (
        <Loader2 className="mr-1 h-4 w-4 animate-spin" />
      ) : (
        <LogOut className="mr-1 h-4 w-4" />
      )}
      Sign out
    </Button>
  );
}
