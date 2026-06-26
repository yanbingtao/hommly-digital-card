'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { getCardByPublicToken } from '@/lib/actions';
import { CardWithOrder, Theme } from '@/lib/types';
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
    const { card: data, error: err } = await getCardByPublicToken(publicToken);
    if (err) {
      setError(err);
    } else {
      setCard(data);
    }
    setLoading(false);
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
    <div className={`flex min-h-screen flex-col items-center justify-center px-4 ${bgClass}`}>
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

  const subTextColor =
    theme === 'birthday'
      ? 'text-amber-700'
      : theme === 'farewell'
      ? 'text-slate-500'
      : 'text-stone-500';

  return (
    <div className={`relative min-h-screen overflow-hidden ${containerBg}`}>
      {theme === 'birthday' && <Confetti />}
      {theme === 'thank_you' && <Sparkles />}

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
                  ? `Happy Birthday, ${card.recipient_name || 'You'}!`
                  : theme === 'farewell'
                  ? `For ${card.recipient_name || 'You'}`
                  : `Dear ${card.recipient_name || 'You'}`}
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

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: card.photo_url ? 1.5 : 1.1, duration: 0.8 }}
              className="mt-6 text-center"
            >
              <p className={`text-sm font-medium ${subTextColor}`}>
                {theme === 'birthday'
                  ? `With love, ${card.sender_name || 'A friend'}`
                  : theme === 'farewell'
                  ? `From ${card.sender_name || 'A friend'}`
                  : `With gratitude, ${card.sender_name || 'A friend'}`}
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
          <p className="text-xs text-stone-400">Made with love by Hommly</p>
        </motion.footer>
      </div>
    </div>
  );
}

function Confetti() {
  const pieces = Array.from({ length: 24 });
  return (
    <div className="pointer-events-none absolute inset-0 z-0">
      {pieces.map((_, i) => {
        const left = Math.random() * 100;
        const delay = Math.random() * 2;
        const duration = 2 + Math.random() * 3;
        const color = ['#fbbf24', '#f87171', '#60a5fa', '#a3e635', '#f472b6'][Math.floor(Math.random() * 5)];
        return (
          <motion.div
            key={i}
            initial={{ y: -20, opacity: 0, rotate: 0 }}
            animate={{ y: '110vh', opacity: [0, 1, 1, 0], rotate: 360 }}
            transition={{ delay, duration, repeat: Infinity, ease: 'linear' }}
            style={{ left: `${left}%`, position: 'absolute', width: 6, height: 6, backgroundColor: color, borderRadius: 2 }}
          />
        );
      })}
    </div>
  );
}

function Sparkles() {
  const pieces = Array.from({ length: 16 });
  return (
    <div className="pointer-events-none absolute inset-0 z-0">
      {pieces.map((_, i) => {
        const left = Math.random() * 100;
        const top = Math.random() * 100;
        const delay = Math.random() * 3;
        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: [0, 0.6, 0], scale: [0, 1, 0] }}
            transition={{ delay, duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
            style={{ left: `${left}%`, top: `${top}%`, position: 'absolute' }}
            className="text-amber-300"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
            </svg>
          </motion.div>
        );
      })}
    </div>
  );
}
