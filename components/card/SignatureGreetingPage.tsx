'use client';

import { motion } from 'framer-motion';
import { HommlyFooter } from '@/components/card/HommlyFooter';
import { RecipientThemeBackground } from '@/components/card/RecipientThemeBackground';

export function SignatureGreetingPage() {
  return (
    <RecipientThemeBackground theme="thank_you">
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
            🎁
          </motion.div>
          <h1 className="text-2xl font-semibold text-stone-700">A little surprise for you</h1>
          <p className="mt-3 text-sm leading-relaxed text-stone-500 sm:text-base">
            A small gift to brighten the moment.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-stone-500 sm:text-base">
            May it bring a little joy to your day.
          </p>
        </motion.div>
      </div>
      <HommlyFooter />
    </RecipientThemeBackground>
  );
}
