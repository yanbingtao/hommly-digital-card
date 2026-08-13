import Image from 'next/image';
import { Check, ExternalLink } from 'lucide-react';
import { HeroProductVisual } from '@/components/home/HeroProductVisual';
import { HOME_ASSETS, type HomeAssetAvailability } from '@/lib/home-assets';
import { LANDING_MAX_WIDTH, SHOP_URL } from './constants';
import { cn } from '@/lib/utils';

const BULLETS = [
  'Personal messages',
  'Photos & eCard themes',
  'Share your social & web links',
  'Optional PIN protection',
  'Instant QR access — no app needed',
  'Free with selected Hommly gifts',
];

type HeroSectionProps = {
  assets: HomeAssetAvailability;
};

export function HeroSection({ assets }: HeroSectionProps) {
  const hasHeroImage = assets.hero;

  return (
    <section
      className={cn(
        'relative overflow-hidden',
        hasHeroImage
          ? 'min-h-[min(92vh,820px)] sm:min-h-[min(88vh,780px)]'
          : 'px-4 pb-16 pt-10 sm:px-6 sm:pb-24 sm:pt-14'
      )}
    >
      {hasHeroImage ? (
        <>
          <Image
            src={HOME_ASSETS.hero}
            alt="Hommly gift with QR card and phone showing a personalised Hommly eCard"
            fill
            priority
            sizes="100vw"
            className="object-cover object-[72%_center] sm:object-[68%_center] lg:object-center"
          />
          {/* Soft scrim so HTML copy stays readable over the photo */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,246,241,0.94)_0%,rgba(255,246,241,0.55)_42%,rgba(255,246,241,0.78)_100%)] sm:bg-[linear-gradient(90deg,rgba(255,246,241,0.96)_0%,rgba(255,246,241,0.72)_38%,rgba(255,246,241,0.18)_62%,transparent_78%)]"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#fffaf7] to-transparent"
          />
        </>
      ) : (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgba(255,228,214,0.75),transparent_55%),radial-gradient(ellipse_at_90%_20%,rgba(254,205,211,0.45),transparent_50%),linear-gradient(180deg,#fffaf7_0%,#fff6f1_45%,#ffffff_100%)]"
        />
      )}

      <div
        className={cn(
          'relative mx-auto',
          LANDING_MAX_WIDTH,
          hasHeroImage
            ? 'flex min-h-[min(92vh,820px)] items-center px-4 py-16 sm:min-h-[min(88vh,780px)] sm:px-6 sm:py-20 lg:py-24'
            : 'grid items-center gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-10 xl:gap-14'
        )}
      >
        <div
          className={cn(
            'motion-safe:animate-hommly-rise',
            hasHeroImage && 'max-w-xl lg:max-w-[34rem]'
          )}
        >
          <p className="mb-5 inline-flex items-center rounded-full border border-rose-200/80 bg-white/85 px-3.5 py-1.5 text-xs font-semibold tracking-wide text-rose-600 shadow-sm shadow-rose-100/60 backdrop-blur-sm">
            Hommly eCard · Free with selected gifts
          </p>

          <h1 className="font-display text-[2.35rem] font-semibold leading-[1.22] tracking-[-0.02em] text-stone-900 sm:text-5xl sm:leading-[1.2] lg:text-[3.5rem] lg:leading-[1.18] xl:text-[3.75rem]">
            More than a gift.
            <br />
            <span className="text-rose-500">A moment they&apos;ll remember.</span>
          </h1>

          <p className="mt-5 max-w-xl text-base leading-relaxed text-stone-600 sm:text-lg">
            Hommly eCard lets you add a personal touch that stays long after the gift is unwrapped.
          </p>

          <ul className="mt-6 grid gap-x-6 gap-y-2 sm:mt-7 sm:grid-cols-1 lg:grid-cols-2 lg:gap-y-2">
            {BULLETS.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm text-stone-700 sm:text-[15px]">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                  <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
                </span>
                {item}
              </li>
            ))}
          </ul>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <a
              href={SHOP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-rose-500 px-6 text-sm font-semibold text-white shadow-lg shadow-rose-500/25 transition hover:bg-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 focus-visible:ring-offset-2"
            >
              Shop Gifts on Hommly.sg
              <ExternalLink className="h-4 w-4" aria-hidden />
            </a>
            <a
              href="#how-it-works"
              className="inline-flex min-h-12 items-center justify-center rounded-xl border border-stone-200 bg-white/90 px-6 text-sm font-semibold text-stone-700 backdrop-blur-sm transition hover:border-stone-300 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-300 focus-visible:ring-offset-2"
            >
              See How It Works
            </a>
          </div>
        </div>

        {!hasHeroImage ? (
          <div className="motion-safe:animate-hommly-rise motion-safe:[animation-delay:120ms]">
            <HeroProductVisual assets={assets} />
          </div>
        ) : null}
      </div>
    </section>
  );
}
