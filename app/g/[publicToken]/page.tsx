'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { CardWithOrder, Theme } from '@/lib/types';
import { createBrowserSupabase } from '@/lib/supabase-browser';
import { Loader2 } from 'lucide-react';

export default function RecipientViewPage() {
  const params = useParams();
  const publicToken = params.publicToken as string;

  const [card, setCard] = useState<CardWithOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [opened, setOpened] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCard = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createBrowserSupabase();
      const { data, error } = await supabase
        .from('digital_cards')
        .select('*, order:orders(*)')
        .eq('public_token', publicToken)
        .maybeSingle();

      if (error) {
        setError(error.message);
        setCard(null);
      } else {
        setCard(data as CardWithOrder | null);
        setError(null);
      }
    } catch {
      setError('Failed to load card');
      setCard(null);
    } finally {
      setLoading(false);
    }
  }, [publicToken]);

  useEffect(() => {
    loadCard();
  }, [loadCard]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50">
        <Loader2 className="h-6 w-6 animate-spin text-stone-400" />
      </div>
    );
  }

  if (error || !card) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50 px-4">
        <div className="text-center">
          <p className="text-lg font-medium text-stone-700">Something went wrong</p>
          <p className="mt-1 text-sm text-stone-500">We could not find this surprise card.</p>
        </div>
      </div>
    );
  }

  if (card.status !== 'published') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50 px-4">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div className="mb-4 text-5xl">🎁</div>
          <h1 className="text-xl font-semibold text-stone-700">A special message is being prepared.</h1>
          <p className="mt-2 text-sm text-stone-500">Check back soon for your surprise.</p>
        </motion.div>
      </div>
    );
  }

  if (!opened) {
    return (
      <OpeningScreen
        theme={card.theme as Theme}
        onOpen={() => setOpened(true)}
      />
    );
  }

  return <CardReveal card={card} />;
}

function OpeningScreen({ theme, onOpen }: { theme: Theme; onOpen: () => void }) {
  const bgClass =
    theme === 'birthday'
      ? 'bg-gradient-to-br from-amber-100 via-orange-50 to-rose-100'
      : theme === 'farewell'
      ? 'bg-gradient-to-b from-slate-100 to-stone-200'
      : 'bg-gradient-to-b from-[#fdf6e3] to-[#f5e6c8]';

  return (
    <div className={`relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 ${bgClass}`}>
      {theme === 'birthday' && <Confetti />}
      {theme === 'thank_you' && <ThankYouAnimation />}
      {theme === 'farewell' && <FarewellAnimation />}

      <div className="relative z-10 flex flex-col items-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className="text-center"
      >
        <motion.div
          animate={{ y: [0, -8, 0] }}
          transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
          className="mb-6 text-6xl"
        >
          {theme === 'birthday' ? '🎁' : theme === 'farewell' ? '💌' : '✨'}
        </motion.div>
        <h1 className="text-2xl font-semibold text-stone-700">
          A little surprise is waiting for you
        </h1>
        <p className="mt-2 text-sm text-stone-500">Someone prepared something thoughtful.</p>
      </motion.div>

      <motion.button
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.6 }}
        whileTap={{ scale: 0.96 }}
        onClick={onOpen}
        className="mt-10 rounded-full bg-rose-500 px-8 py-3.5 text-sm font-medium text-white shadow-lg shadow-rose-200 transition-colors hover:bg-rose-600"
      >
        Tap to open
      </motion.button>
      </div>
    </div>
  );
}

function CardReveal({ card }: { card: CardWithOrder }) {
  const theme = card.theme as Theme;

  const containerBg =
    theme === 'birthday'
      ? 'bg-gradient-to-br from-amber-100 via-orange-50 to-rose-100'
      : theme === 'farewell'
      ? 'bg-gradient-to-b from-slate-100 to-stone-200'
      : 'bg-gradient-to-b from-[#fdf6e3] to-[#f5e6c8]';

  const textColor =
    theme === 'birthday'
      ? 'text-amber-900'
      : theme === 'farewell'
      ? 'text-slate-700'
      : 'text-stone-700';

  return (
    <div className={`relative min-h-screen overflow-hidden ${containerBg}`}>
      {theme === 'birthday' && <Confetti />}
      {theme === 'thank_you' && <ThankYouAnimation />}
      {theme === 'farewell' && <FarewellAnimation />}

      <div className="relative z-10 flex min-h-screen flex-col items-center px-5 py-10">
        <motion.div
          initial={{ opacity: 0, rotateX: 45, scale: 0.9 }}
          animate={{ opacity: 1, rotateX: 0, scale: 1 }}
          transition={{ duration: 1, ease: 'easeOut' }}
          className="w-full max-w-md"
        >
          <div className="overflow-hidden rounded-2xl bg-white/70 p-6 shadow-xl shadow-stone-200/50 backdrop-blur-sm sm:p-8">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.7 }}
            >
              <div className="mb-4 text-center text-4xl">
                {theme === 'birthday' ? '🎉' : theme === 'farewell' ? '💌' : '✨'}
              </div>
              <h2 className={`text-center text-xl font-semibold ${textColor}`}>
                {theme === 'birthday'
                  ? 'Happy Birthday!'
                  : theme === 'farewell'
                  ? 'A special message for you'
                  : 'A heartfelt message'}
              </h2>
            </motion.div>

            <AnimatePresence>
              {card.photo_url && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.7, duration: 0.8 }}
                  className="mt-5 overflow-hidden rounded-xl"
                >
                  <img
                    src={card.photo_url}
                    alt="A thoughtful photo"
                    className="h-56 w-full object-cover sm:h-64"
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: card.photo_url ? 1.1 : 0.7, duration: 0.8 }}
              className="mt-6"
            >
              <p className={`whitespace-pre-wrap text-center text-base leading-relaxed ${textColor}`}>
                {card.message}
              </p>
            </motion.div>
          </div>
        </motion.div>

        <motion.footer
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2, duration: 1 }}
          className="mt-10 text-center"
        >
          <p className="text-xs text-stone-400">Made with love by Hommly.sg ❤️</p>
        </motion.footer>
      </div>
    </div>
  );
}

function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 24 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 2,
        duration: 2 + Math.random() * 3,
        color: ['#fbbf24', '#f87171', '#60a5fa', '#a3e635', '#f472b6'][i % 5],
      })),
    []
  );

  return (
    <div className="pointer-events-none absolute inset-0 z-0">
      {pieces.map((piece) => (
        <motion.div
          key={piece.id}
          initial={{ y: -20, opacity: 0, rotate: 0 }}
          animate={{ y: '110vh', opacity: [0, 1, 1, 0], rotate: 360 }}
          transition={{ delay: piece.delay, duration: piece.duration, repeat: Infinity, ease: 'linear' }}
          style={{
            left: `${piece.left}%`,
            position: 'absolute',
            width: 6,
            height: 6,
            backgroundColor: piece.color,
            borderRadius: 2,
          }}
        />
      ))}
    </div>
  );
}

function ThankYouAnimation() {
  const driftPieces = useMemo(
    () =>
      Array.from({ length: 20 }, (_, i) => ({
        id: `drift-${i}`,
        left: Math.random() * 100,
        delay: Math.random() * 3,
        duration: 4 + Math.random() * 3,
        size: 5 + Math.random() * 5,
        drift: (Math.random() - 0.5) * 50,
        color: ['#fbbf24', '#f59e0b', '#fda4af', '#fcd34d', '#fb923c'][i % 5],
      })),
    []
  );

  const sparkles = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        id: `sparkle-${i}`,
        left: Math.random() * 100,
        top: Math.random() * 100,
        delay: Math.random() * 2.5,
        duration: 2 + Math.random() * 2,
      })),
    []
  );

  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      {driftPieces.map((piece) => (
        <motion.div
          key={piece.id}
          initial={{ y: -30, x: 0, opacity: 0, rotate: 0 }}
          animate={{
            y: '110vh',
            x: [0, piece.drift, piece.drift * 0.5],
            opacity: [0, 0.85, 0.85, 0],
            rotate: [0, 180, 360],
          }}
          transition={{ delay: piece.delay, duration: piece.duration, repeat: Infinity, ease: 'linear' }}
          style={{
            left: `${piece.left}%`,
            position: 'absolute',
            width: piece.size,
            height: piece.size,
            backgroundColor: piece.color,
            borderRadius: '50%',
          }}
        />
      ))}
      {sparkles.map((sparkle) => (
        <motion.div
          key={sparkle.id}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: [0, 0.7, 0], scale: [0, 1.2, 0] }}
          transition={{
            delay: sparkle.delay,
            duration: sparkle.duration,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          style={{ left: `${sparkle.left}%`, top: `${sparkle.top}%`, position: 'absolute' }}
          className="text-amber-400"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
          </svg>
        </motion.div>
      ))}
    </div>
  );
}

function FarewellAnimation() {
  const petals = useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 4,
        duration: 6 + Math.random() * 4,
        width: 6 + Math.random() * 6,
        height: 10 + Math.random() * 10,
        drift: (Math.random() - 0.5) * 60,
        color: ['#c4b5fd', '#fda4af', '#94a3b8', '#e9d5ff', '#a8a29e'][i % 5],
      })),
    []
  );

  const glows = useMemo(
    () =>
      Array.from({ length: 10 }, (_, i) => ({
        id: `glow-${i}`,
        left: Math.random() * 100,
        top: Math.random() * 100,
        delay: Math.random() * 3,
        duration: 3 + Math.random() * 2,
      })),
    []
  );

  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      {petals.map((petal) => (
        <motion.div
          key={petal.id}
          initial={{ y: -40, x: 0, opacity: 0, rotate: 0 }}
          animate={{
            y: '110vh',
            x: [0, petal.drift, petal.drift * 0.3],
            opacity: [0, 0.6, 0.6, 0],
            rotate: [0, 120, 240, 360],
          }}
          transition={{ delay: petal.delay, duration: petal.duration, repeat: Infinity, ease: 'linear' }}
          style={{
            left: `${petal.left}%`,
            position: 'absolute',
            width: petal.width,
            height: petal.height,
            backgroundColor: petal.color,
            borderRadius: '50% 50% 50% 0',
          }}
        />
      ))}
      {glows.map((glow) => (
        <motion.div
          key={glow.id}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: [0, 0.35, 0], scale: [0.5, 1.5, 0.5] }}
          transition={{
            delay: glow.delay,
            duration: glow.duration,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          style={{ left: `${glow.left}%`, top: `${glow.top}%`, position: 'absolute' }}
          className="h-3 w-3 rounded-full bg-violet-200/80 blur-[1px]"
        />
      ))}
    </div>
  );
}
