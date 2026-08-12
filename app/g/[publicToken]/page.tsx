'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Theme } from '@/lib/types';
import { isValidPublicToken } from '@/lib/card-availability';
import {
  fetchRecipientViewContent,
  fetchRecipientViewMeta,
} from '@/lib/recipient-view-actions';
import type { RecipientDisplayCard } from '@/lib/recipient-display-card';
import { HommlyFooter, HommlyFooterText } from '@/components/card/HommlyFooter';
import { SignatureGreetingPage } from '@/components/card/SignatureGreetingPage';
import { ViewPinScreen } from '@/components/card/ViewPinScreen';
import { SenderLinkIcons } from '@/components/card/SenderLinkIcons';
import { getVisibleSenderLinks, shouldShowSenderLinks } from '@/lib/sender-links';
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
  const viewToken = params.publicToken as string;

  const [display, setDisplay] = useState<RecipientDisplayCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [pinVerified, setPinVerified] = useState(false);
  const [verifiedPin, setVerifiedPin] = useState<string | null>(null);
  const [opened, setOpened] = useState(false);

  const fetchContent = useCallback(async (): Promise<RecipientDisplayCard | null> => {
    if (!isValidPublicToken(viewToken)) return null;

    try {
      const { available, display: content } = await fetchRecipientViewContent(viewToken);
      if (!available || !content) return null;
      return content;
    } catch {
      return null;
    }
  }, [viewToken]);

  const loadMeta = useCallback(async () => {
    setLoading(true);

    if (!isValidPublicToken(viewToken)) {
      setUnavailable(true);
      setDisplay(null);
      setLoading(false);
      return;
    }

    try {
      const { available, display: meta } = await fetchRecipientViewMeta(viewToken);

      if (!available || !meta || meta.status !== 'published') {
        setUnavailable(true);
        setDisplay(null);
      } else {
        setUnavailable(false);

        if (!meta.view_pin_enabled) {
          const full = await fetchContent();
          setDisplay(full ?? meta);
          setPinVerified(true);
        } else {
          setDisplay(meta);
          setPinVerified(false);
        }
      }
    } catch {
      setUnavailable(true);
      setDisplay(null);
    } finally {
      setLoading(false);
    }
  }, [viewToken, fetchContent]);

  const handlePinVerified = useCallback(async (pin: string) => {
    const full = await fetchContent();
    if (full) {
      setDisplay(full);
      setVerifiedPin(pin);
      setPinVerified(true);
    }
  }, [fetchContent]);

  const handleOpenCard = useCallback(async () => {
    if (!isValidPublicToken(viewToken)) return;
    if (display?.view_pin_enabled && !pinVerified) return;

    const full = await fetchContent();
    if (full) {
      setDisplay(full);
      setUnavailable(false);
    }

    setOpened(true);
  }, [viewToken, display?.view_pin_enabled, pinVerified, fetchContent]);

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#faf6ee]">
        <Loader2 className="h-6 w-6 animate-spin text-stone-400" />
      </div>
    );
  }

  if (unavailable || !display || display.status !== 'published') {
    return <SignatureGreetingPage />;
  }

  if (display.view_pin_enabled && !pinVerified) {
    return (
      <ViewPinScreen
        theme={display.theme as Theme}
        publicToken={viewToken}
        onVerified={(pin) => void handlePinVerified(pin)}
      />
    );
  }

  if (!opened) {
    return (
      <OpeningScreen
        theme={display.theme as Theme}
        onOpen={() => void handleOpenCard()}
      />
    );
  }

  return (
    <CardReveal
      display={display}
      pinVerified={pinVerified}
      viewToken={viewToken}
      viewPin={display.view_pin_enabled ? verifiedPin : null}
    />
  );
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

function CardReveal({
  display,
  pinVerified = true,
  viewToken,
  viewPin = null,
}: {
  display: RecipientDisplayCard;
  pinVerified?: boolean;
  viewToken: string;
  viewPin?: string | null;
}) {
  const theme = display.theme as Theme;
  const linkCard = {
    status: display.status,
    show_sender_links: display.show_sender_links,
    sender_links: display.sender_links,
  };
  const visibleSenderLinks = shouldShowSenderLinks(linkCard, { pinVerified })
    ? getVisibleSenderLinks(linkCard)
    : [];

  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoLoading, setPhotoLoading] = useState(false);
  const pinRef = useRef(pinVerified);

  useEffect(() => {
    pinRef.current = pinVerified;
  }, [pinVerified]);

  useEffect(() => {
    if (!pinVerified || !display.photo_available) {
      setPhotoUrl(null);
      return;
    }

    let cancelled = false;
    setPhotoLoading(true);

    const loadPhoto = async () => {
      try {
        const response = await fetch('/api/cards/view-photo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            public_token: viewToken,
            ...(display.view_pin_enabled && viewPin ? { pin: viewPin } : {}),
          }),
        });
        const data = (await response.json()) as { signedUrl?: string | null };
        if (!cancelled && pinRef.current) {
          setPhotoUrl(data.signedUrl ?? null);
        }
      } catch {
        if (!cancelled) setPhotoUrl(null);
      } finally {
        if (!cancelled) setPhotoLoading(false);
      }
    };

    void loadPhoto();
    return () => {
      cancelled = true;
    };
  }, [display.photo_available, display.view_pin_enabled, pinVerified, viewToken, viewPin]);

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

            {(photoLoading || photoUrl) && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55, duration: 0.7 }}
                className="mt-5 overflow-hidden rounded-xl bg-stone-100/80 ring-1 ring-stone-200/60"
              >
                {photoLoading ? (
                  <div className="flex h-40 items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-stone-400" />
                  </div>
                ) : photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photoUrl}
                    alt="A photo from the sender"
                    className="max-h-72 w-full object-cover"
                  />
                ) : null}
              </motion.div>
            )}

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7, duration: 0.8 }}
              className="mt-6"
            >
              <p className={`whitespace-pre-wrap text-center text-base leading-relaxed ${textColor}`}>
                {display.message}
              </p>
            </motion.div>

            {visibleSenderLinks.length > 0 && (
              <SenderLinkIcons links={visibleSenderLinks} className="mt-6" />
            )}
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
