import Image from 'next/image';
import { HomeAssetImage } from '@/components/home/HomeAssetImage';
import { PhoneEcardMockup } from '@/components/home/PhoneEcardMockup';
import { HOME_ASSETS, type HomeAssetAvailability } from '@/lib/home-assets';
import { cn } from '@/lib/utils';

function QrCardVisual({
  available,
  className,
}: {
  available: boolean;
  className?: string;
}) {
  if (available) {
    return (
      <div
        className={cn(
          'w-[140px] overflow-hidden rounded-2xl bg-white p-2 shadow-[0_18px_40px_-20px_rgba(28,25,23,0.35)] ring-1 ring-stone-200/80 motion-safe:animate-hommly-float',
          className
        )}
      >
        <div className="relative aspect-square w-full overflow-hidden rounded-xl">
          <Image
            src={HOME_ASSETS.qrCard}
            alt="Hommly physical QR card included with the gift"
            fill
            sizes="140px"
            className="object-cover"
          />
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'w-[132px] rounded-2xl bg-white p-3.5 shadow-[0_18px_40px_-20px_rgba(28,25,23,0.35)] ring-1 ring-stone-200/80 motion-safe:animate-hommly-float',
        className
      )}
    >
      <div className="grid grid-cols-5 gap-[3px] rounded-lg bg-stone-50 p-2" aria-hidden>
        {Array.from({ length: 25 }).map((_, i) => (
          <span
            key={i}
            className={cn(
              'h-2.5 w-2.5 rounded-[2px]',
              [0, 1, 2, 4, 5, 6, 10, 12, 14, 18, 20, 21, 22, 24].includes(i)
                ? 'bg-stone-800'
                : 'bg-stone-300'
            )}
          />
        ))}
      </div>
      <p className="mt-2.5 text-center text-[9px] font-semibold uppercase tracking-[0.18em] text-stone-400">
        QR card
      </p>
      <p className="mt-1 text-center text-[9px] text-stone-400">Add qr-card.webp</p>
    </div>
  );
}

type HeroProductVisualProps = {
  assets: HomeAssetAvailability;
  className?: string;
};

/**
 * Hero product visual.
 * Prefers a single wide Hommly composition image when present.
 * Falls back to gift + QR + CSS phone mockup (with neutral placeholders).
 */
export function HeroProductVisual({ assets, className }: HeroProductVisualProps) {
  if (assets.hero) {
    return (
      <div className={cn('relative mx-auto w-full max-w-[560px]', className)}>
        <div
          aria-hidden
          className="pointer-events-none absolute -left-8 top-8 h-48 w-48 rounded-full bg-rose-200/40 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-4 bottom-4 h-56 w-56 rounded-full bg-amber-100/50 blur-3xl"
        />
        <div className="relative overflow-hidden rounded-[1.75rem] shadow-[0_30px_60px_-28px_rgba(28,25,23,0.45)] ring-1 ring-white/70">
          <div className="relative aspect-[16/10] w-full sm:aspect-[5/3]">
            <Image
              src={HOME_ASSETS.hero}
              alt="Hommly gift with QR card and phone showing a personalised Hommly eCard"
              fill
              priority
              sizes="(max-width: 768px) 92vw, 560px"
              className="object-cover object-center"
            />
          </div>
        </div>
        <p className="sr-only">
          Visual of a Hommly gift, QR card, and phone displaying a Hommly eCard. Headlines and
          buttons are shown separately as text.
        </p>
      </div>
    );
  }

  return (
    <div className={cn('relative mx-auto w-full max-w-[520px]', className)}>
      <div
        aria-hidden
        className="pointer-events-none absolute -left-8 top-8 h-48 w-48 rounded-full bg-rose-200/40 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-4 bottom-4 h-56 w-56 rounded-full bg-amber-100/50 blur-3xl"
      />

      <div className="relative z-0 ml-0 w-[72%] overflow-hidden rounded-[1.75rem] shadow-[0_30px_60px_-28px_rgba(28,25,23,0.45)] ring-1 ring-white/70 sm:ml-2">
        <HomeAssetImage
          src={HOME_ASSETS.giftBox}
          available={assets.giftBox}
          alt="Physical Hommly gift ready to include a personalised eCard"
          placeholderLabel="Add /home/gift-box.webp"
          priority
          sizes="(max-width: 768px) 70vw, 360px"
          aspectClassName="aspect-[4/5]"
        />
      </div>

      <div className="absolute left-[4%] top-[58%] z-20 sm:left-[8%] sm:top-[62%]">
        <QrCardVisual available={assets.qrCard} />
      </div>

      <div className="absolute -right-1 top-[6%] z-10 w-[54%] sm:-right-2 sm:top-[4%] sm:w-[52%]">
        <PhoneEcardMockup size="sm" className="mx-0 w-full" />
      </div>

      <p className="sr-only">
        Hommly gift with QR card that opens a personalised digital eCard on the recipient&apos;s
        phone. Replace missing assets under /public/home/.
      </p>
    </div>
  );
}
