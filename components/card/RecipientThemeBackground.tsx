'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Theme } from '@/lib/types';

export function themeEmoji(theme: Theme) {
  return theme === 'birthday' ? '🎁' : theme === 'farewell' ? '💌' : '✨';
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

export function ThankYouAnimation() {
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

export function RecipientThemeBackground({
  theme,
  children,
}: {
  theme: Theme;
  children: React.ReactNode;
}) {
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
      {children}
    </div>
  );
}
