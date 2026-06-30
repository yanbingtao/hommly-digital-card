'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Lock } from 'lucide-react';
import { Theme } from '@/lib/types';
import { verifyCardViewPin } from '@/lib/actions';
import { HommlyFooter } from '@/components/card/HommlyFooter';
import { RecipientThemeBackground, themeEmoji } from '@/components/card/RecipientThemeBackground';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

interface ViewPinScreenProps {
  theme: Theme;
  publicToken: string;
  onVerified: () => void;
}

export function ViewPinScreen({ theme, publicToken, onVerified }: ViewPinScreenProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const { success, error: verifyError } = await verifyCardViewPin(publicToken, pin);
      if (verifyError) {
        setError(verifyError);
        return;
      }
      if (!success) {
        setError('That PIN does not match. Please try again.');
        setPin('');
        return;
      }
      onVerified();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <RecipientThemeBackground theme={theme}>
      <div className="relative z-10 flex w-full max-w-sm flex-col items-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          className="w-full text-center"
        >
          <motion.div
            animate={{ y: [0, -6, 0] }}
            transition={{ repeat: Infinity, duration: 2.8, ease: 'easeInOut' }}
            className="mb-5 text-5xl"
          >
            {themeEmoji(theme)}
          </motion.div>

          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white/70 text-stone-500 shadow-sm ring-1 ring-stone-200/60">
            <Lock className="h-5 w-5" strokeWidth={1.75} />
          </div>

          <h1 className="text-xl font-semibold text-stone-700">Enter your viewing PIN</h1>
          <p className="mt-2 text-sm text-stone-500">
            The sender shared a PIN so only you can open this message.
          </p>

          <form onSubmit={(event) => void handleSubmit(event)} className="mt-8 space-y-4">
            <div className="space-y-2 text-left">
              <Label htmlFor="view-pin" className="sr-only">
                Viewing PIN
              </Label>
              <Input
                id="view-pin"
                type="password"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                maxLength={6}
                value={pin}
                onChange={(event) => setPin(event.target.value.replace(/\D/g, ''))}
                placeholder="4–6 digit PIN"
                className="text-center text-lg tracking-widest"
              />
            </div>

            {error && <p className="text-sm text-rose-600">{error}</p>}

            <Button
              type="submit"
              disabled={submitting || pin.length < 4}
              className="w-full bg-rose-500 hover:bg-rose-600"
            >
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Continue
            </Button>
          </form>
        </motion.div>
      </div>
      <HommlyFooter />
    </RecipientThemeBackground>
  );
}
