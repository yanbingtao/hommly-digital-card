'use client';

import { motion } from 'framer-motion';

export function HommlyFooterText() {
  return (
    <p className="text-xs text-stone-400">
      Made with love by{' '}
      <a
        href="https://www.hommly.sg"
        target="_blank"
        rel="noopener noreferrer"
        className="underline decoration-stone-300 underline-offset-2 transition-colors hover:text-stone-600"
      >
        Hommly.sg
      </a>{' '}
      ❤️
    </p>
  );
}

export function HommlyFooter({ className }: { className?: string }) {
  return (
    <motion.footer
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 1, duration: 0.8 }}
      className={className ?? 'absolute bottom-8 left-0 right-0 z-10 text-center'}
    >
      <HommlyFooterText />
    </motion.footer>
  );
}
