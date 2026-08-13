'use client';

import { ArrowUpRight } from 'lucide-react';
import { HomeAssetImage } from '@/components/home/HomeAssetImage';
import { HOME_ASSETS, type HomeAssetAvailability } from '@/lib/home-asset-paths';
import { LANDING_MAX_WIDTH, SHOP_URL } from './constants';
import { cn } from '@/lib/utils';

type Occasion = {
  title: string;
  tone: string;
  imageSrc: string;
  imageAvailable: boolean;
  placeholderLabel: string;
};

type OccasionsSectionProps = {
  assets: HomeAssetAvailability;
};

function MoreCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'relative flex h-full flex-col justify-between overflow-hidden rounded-2xl bg-stone-900 px-4 py-4 text-left ring-1 ring-stone-900/10 sm:px-5 sm:py-5',
        className
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgba(251,113,133,0.35),transparent_55%),radial-gradient(ellipse_at_100%_100%,rgba(251,146,60,0.28),transparent_50%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.12] [background-image:linear-gradient(rgba(255,255,255,0.35)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.35)_1px,transparent_1px)] [background-size:22px_22px]"
      />

      <div className="relative">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-rose-200/90">
          Hommly shop
        </p>
        <p className="mt-2 font-display text-xl font-semibold leading-[1.2] tracking-[-0.02em] text-white sm:text-2xl">
          And more
          <span className="text-rose-300">…</span>
        </p>
        <p className="mt-2 max-w-[16rem] text-xs leading-relaxed text-stone-300 sm:text-[13px]">
          Explore every Hommly gift occasion on Hommly.sg.
        </p>
      </div>

      <span className="relative mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-white">
        Browse gifts
        <ArrowUpRight
          className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transition-none"
          aria-hidden
        />
      </span>
    </div>
  );
}

function OccasionCard({ item }: { item: Occasion }) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl ring-1 transition duration-200 motion-reduce:transition-none',
        'group-hover/card:-translate-y-0.5 group-hover/card:shadow-md group-hover/card:shadow-stone-200/60',
        item.tone
      )}
    >
      <HomeAssetImage
        src={item.imageSrc}
        available={item.imageAvailable}
        alt={`Hommly gift for ${item.title}`}
        placeholderLabel={`Add /home/products/${item.placeholderLabel}`}
        sizes="260px"
        aspectClassName="aspect-[4/3]"
        className="rounded-none"
      />
      <p className="px-3 py-3 text-sm font-medium">{item.title}</p>
    </div>
  );
}

export function OccasionsSection({ assets }: OccasionsSectionProps) {
  const occasions: Occasion[] = [
    {
      title: 'Teacher Appreciation',
      tone: 'bg-[#fff1f2] text-rose-800 ring-rose-100',
      imageSrc: HOME_ASSETS.products.teacher,
      imageAvailable: assets.products.teacher,
      placeholderLabel: 'teacher-gift.webp',
    },
    {
      title: 'Farewell Gifts',
      tone: 'bg-[#fff7ed] text-orange-900 ring-orange-100',
      imageSrc: HOME_ASSETS.products.farewell,
      imageAvailable: assets.products.farewell,
      placeholderLabel: 'farewell-gift.webp',
    },
    {
      title: 'Birthdays',
      tone: 'bg-[#fffbeb] text-amber-900 ring-amber-100',
      imageSrc: HOME_ASSETS.products.birthday,
      imageAvailable: assets.products.birthday,
      placeholderLabel: 'birthday-gift.webp',
    },
    {
      title: 'Office Gifts',
      tone: 'bg-stone-100 text-stone-800 ring-stone-200',
      imageSrc: HOME_ASSETS.products.office,
      imageAvailable: assets.products.office,
      placeholderLabel: 'office-gift.webp',
    },
    {
      title: 'Team Appreciation',
      tone: 'bg-[#fdf4ff] text-fuchsia-900 ring-fuchsia-100',
      imageSrc: HOME_ASSETS.products.team,
      imageAvailable: assets.products.team,
      placeholderLabel: 'team-gift.webp',
    },
    {
      title: 'Graduation',
      tone: 'bg-[#f0f9ff] text-sky-900 ring-sky-100',
      imageSrc: HOME_ASSETS.products.graduation,
      imageAvailable: assets.products.graduation,
      placeholderLabel: 'graduation-gift.webp',
    },
    {
      title: 'Housewarming',
      tone: 'bg-[#fff7ed] text-orange-900 ring-orange-100',
      imageSrc: HOME_ASSETS.products.housewarming,
      imageAvailable: assets.products.housewarming,
      placeholderLabel: 'housewarming-gift.webp',
    },
    {
      title: 'Thank You',
      tone: 'bg-[#fff1f2] text-rose-800 ring-rose-100',
      imageSrc: HOME_ASSETS.products.thankYou,
      imageAvailable: assets.products.thankYou,
      placeholderLabel: 'thank-you-gift.webp',
    },
  ];

  const slides = [
    ...occasions.map((item) => ({ kind: 'occasion' as const, item })),
    { kind: 'more' as const },
  ];

  // Duplicate track for seamless loop (translateX -50%)
  const loopSlides = [...slides, ...slides];

  return (
    <section className="bg-white py-16 sm:py-24">
      <div className={cn('mx-auto px-4 sm:px-6', LANDING_MAX_WIDTH)}>
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-500">
            Perfect for every occasion
          </p>
          <h2 className="mt-3 font-display text-3xl font-semibold leading-[1.25] tracking-[-0.02em] text-stone-900 sm:text-4xl sm:leading-[1.22]">
            Every moment deserves a personal touch
          </h2>
        </div>
      </div>

      <div
        className="group/marquee relative mt-10 overflow-hidden sm:mt-12"
        aria-label="Hommly gift occasions. Hover to pause. Click any card to shop on Hommly.sg."
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-white to-transparent sm:w-16"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-white to-transparent sm:w-16"
        />

        <div className="flex w-max animate-hommly-marquee gap-3 py-1 pl-4 will-change-transform group-hover/marquee:[animation-play-state:paused] group-focus-within/marquee:[animation-play-state:paused] motion-reduce:animate-none sm:gap-4 sm:pl-6">
          {loopSlides.map((slide, index) => {
            const key =
              slide.kind === 'occasion'
                ? `${slide.item.title}-${index}`
                : `more-${index}`;

            return (
              <a
                key={key}
                href={SHOP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="group/card block w-[220px] shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 focus-visible:ring-offset-2 sm:w-[260px]"
              >
                {slide.kind === 'occasion' ? (
                  <OccasionCard item={slide.item} />
                ) : (
                  <MoreCard className="min-h-[210px] sm:min-h-[240px]" />
                )}
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
}
