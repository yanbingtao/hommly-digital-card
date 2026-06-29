'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { CardWithOrder, Theme } from '@/lib/types';
import { getCardByPublicToken } from '@/lib/actions';
import { isRecipientCardUnavailable, isValidPublicToken } from '@/lib/card-availability';
import { HommlyFooter, HommlyFooterText } from '@/components/card/HommlyFooter';
import { SignatureGreetingPage } from '@/components/card/SignatureGreetingPage';
import {
  RecipientThemeBackground,
  Confetti,
  ThankYouAnimation,
  FarewellAnimation,
  themeEmoji,
} from '@/components/card/RecipientThemeBackground';
import { Loader2 } from 'lucide-react';

export default function RecipientViewPage() {
  const params = useParams();
  const publicToken = params.publicToken as string;

  const [card, setCard] = useState<CardWithOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [opened, setOpened] = useState(false);

  const loadCard = useCallback(async () => {
    setLoading(true);

    if (!isValidPublicToken(publicToken)) {
      setUnavailable(true);
      setCard(null);
      setLoading(false);
      return;
    }

    try {
      const { card: data, error } = await getCardByPublicToken(publicToken);

      if (error || isRecipientCardUnavailable(data)) {
        setUnavailable(true);
        setCard(null);
      } else {
        setCard(data);
        setUnavailable(false);
      }
    } catch {
      setUnavailable(true);
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
      <div className="flex min-h-screen items-center justify-center bg-[#faf6ee]">
        <Loader2 className="h-6 w-6 animate-spin text-stone-400" />
      </div>
    );
  }

  if (unavailable || !card || card.status !== 'published') {
    return <SignatureGreetingPage />;
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
  return (
    <RecipientThemeBackground theme={theme}>
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
            {themeEmoji(theme)}
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
      <HommlyFooter />
    </RecipientThemeBackground>
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
          <HommlyFooterText />
        </motion.footer>
      </div>
    </div>
  );
}
