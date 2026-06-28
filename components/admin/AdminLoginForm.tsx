'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useSearchParams } from 'next/navigation';
import { loginAdmin } from '@/app/actions/admin-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Gift, Loader2, Lock } from 'lucide-react';

export function AdminLoginForm() {
  const searchParams = useSearchParams();
  const nextPath = searchParams.get('next') || '/admin/cards';
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await loginAdmin(password, nextPath);
      if (!result.success) {
        setError(result.error || 'Login failed');
        return;
      }

      // Full page load ensures the session cookie is sent on the next request.
      window.location.assign(result.redirectTo || '/admin/cards');
    });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#fdf8f3] px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center gap-2 text-stone-700">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-rose-100 to-amber-100">
              <Gift className="h-5 w-5 text-rose-500" aria-hidden />
            </span>
            <span className="text-lg font-semibold">Hommly Admin</span>
          </Link>
        </div>

        <Card className="border-stone-200 shadow-sm">
          <CardHeader className="space-y-2 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-50">
              <Lock className="h-5 w-5 text-rose-500" aria-hidden />
            </div>
            <CardTitle className="text-xl text-stone-800">Admin Management</CardTitle>
            <p className="text-sm text-stone-500">Enter the admin password to continue.</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter admin password"
                  autoComplete="current-password"
                  required
                />
              </div>

              {error ? (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-100">
                  {error}
                </p>
              ) : null}

              <Button
                type="submit"
                disabled={isPending}
                className="w-full bg-rose-500 hover:bg-rose-600"
              >
                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Sign in
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
