'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { REGEXP_ONLY_DIGITS } from 'input-otp';
import { verifyBuyerEditPinAction } from '@/lib/edit-pin-actions';
import { HOMMLY_ECARD_EMAIL, HOMMLY_ECARD_MAILTO } from '@/components/home/constants';
import { BrandLogo } from '@/components/BrandLogo';
import { Button } from '@/components/ui/button';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { cn } from '@/lib/utils';

type EditPinGateProps = {
  editToken: string;
};

export function EditPinGate({ editToken }: EditPinGateProps) {
  const router = useRouter();
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (pin.length !== 6) {
      setError('Please enter your 6-digit Edit PIN.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await verifyBuyerEditPinAction(editToken, pin);
      if (!result.ok) {
        setError(result.error || 'That PIN doesn\'t match. Please try again.');
        setPin('');
        return;
      }
      router.refresh();
    } catch {
      setError('Something went wrong. Please try again.');
      setPin('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="hommly-landing flex min-h-screen flex-col bg-[#fffaf7] px-4 py-10 sm:py-16">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-10 flex justify-center">
          <BrandLogo href={null} />
        </div>

        <div className="rounded-[1.75rem] bg-white px-6 py-8 shadow-[0_24px_50px_-36px_rgba(28,25,23,0.35)] ring-1 ring-stone-200/80 sm:px-8 sm:py-10">
          <p className="text-center text-[11px] font-semibold uppercase tracking-[0.22em] text-rose-500">
            Hommly eCards
          </p>
          <h1 className="mt-3 text-center font-display text-2xl font-semibold tracking-[-0.02em] text-stone-900 sm:text-3xl">
            Enter your Edit PIN
          </h1>
          <p className="mt-3 text-center text-sm leading-relaxed text-stone-500">
            Enter the 6-digit PIN for this Hommly eCard to continue editing.
          </p>

          <form onSubmit={(event) => void handleSubmit(event)} className="mt-8 space-y-6">
            <div className="flex flex-col items-center gap-3">
              <label htmlFor="edit-pin" className="sr-only">
                6-digit Edit PIN
              </label>
              <InputOTP
                id="edit-pin"
                maxLength={6}
                pattern={REGEXP_ONLY_DIGITS}
                inputMode="numeric"
                autoComplete="one-time-code"
                value={pin}
                onChange={(value) => {
                  setPin(value);
                  if (error) setError(null);
                }}
                disabled={submitting}
                containerClassName="gap-2 sm:gap-2.5"
              >
                <InputOTPGroup className="gap-2 sm:gap-2.5">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <InputOTPSlot
                      key={index}
                      index={index}
                      className={cn(
                        'h-12 w-10 rounded-xl border border-stone-200 text-base font-semibold text-stone-800 sm:h-14 sm:w-11',
                        'data-[active=true]:z-10 data-[active=true]:border-rose-400 data-[active=true]:ring-2 data-[active=true]:ring-rose-200'
                      )}
                    />
                  ))}
                </InputOTPGroup>
              </InputOTP>
              <div className="min-h-[1.25rem] text-center text-sm text-rose-600" role="alert">
                {error}
              </div>
            </div>

            <Button
              type="submit"
              disabled={submitting || pin.length !== 6}
              className="h-12 w-full rounded-xl bg-rose-500 text-sm font-semibold text-white hover:bg-rose-600"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Checking…
                </>
              ) : (
                'Continue'
              )}
            </Button>
          </form>
        </div>

        <div className="mt-8 rounded-2xl bg-white/70 px-5 py-4 text-center ring-1 ring-stone-200/70">
          <p className="text-sm font-semibold text-stone-800">Can&apos;t find your Edit PIN?</p>
          <p className="mt-2 text-sm leading-relaxed text-stone-500">
            Contact{' '}
            <a
              href={HOMMLY_ECARD_MAILTO}
              className="font-medium text-rose-600 underline-offset-2 hover:underline"
            >
              {HOMMLY_ECARD_EMAIL}
            </a>{' '}
            with your <span className="font-medium text-stone-700">Order ID</span> and a{' '}
            <span className="font-medium text-stone-700">photo of the Hommly product you received</span>{' '}
            for verification.
          </p>
        </div>
      </div>
    </div>
  );
}
