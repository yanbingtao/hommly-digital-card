import { ExternalLink } from 'lucide-react';
import { HomeAssetImage } from '@/components/home/HomeAssetImage';
import { HOME_ASSETS, type HomeAssetAvailability } from '@/lib/home-assets';
import { LANDING_MAX_WIDTH, SHOP_URL } from './constants';
import { cn } from '@/lib/utils';

type HommlyGiftSectionProps = {
  assets: HomeAssetAvailability;
};

export function HommlyGiftSection({ assets }: HommlyGiftSectionProps) {
  return (
    <section className="bg-[#fffaf7] px-4 py-16 sm:px-6 sm:py-24">
      <div className={cn('mx-auto', LANDING_MAX_WIDTH)}>
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-500">
              Hommly.sg × Hommly.online
            </p>
            <h2 className="mt-3 font-display text-3xl font-semibold leading-[1.25] tracking-[-0.02em] text-stone-900 sm:text-4xl sm:leading-[1.22]">
              Made for Hommly gifts
            </h2>
            <p className="mt-4 max-w-lg text-base leading-relaxed text-stone-600">
              Choose an eligible gift from Hommly.sg and add a personal eCard at no extra cost. The
              physical gift is what they unwrap — the Hommly eCard is what makes it personal.
            </p>
            <a
              href={SHOP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-8 inline-flex min-h-12 items-center gap-2 rounded-xl bg-stone-900 px-6 text-sm font-semibold text-white transition hover:bg-stone-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400 focus-visible:ring-offset-2"
            >
              Explore Hommly Gifts
              <ExternalLink className="h-4 w-4" aria-hidden />
            </a>
          </div>

          <div className="relative mx-auto w-full max-w-md">
            <div className="overflow-hidden rounded-[1.75rem] shadow-[0_28px_50px_-28px_rgba(28,25,23,0.4)] ring-1 ring-stone-200/70">
              <HomeAssetImage
                src={HOME_ASSETS.giftBox}
                available={assets.giftBox}
                alt="Hommly gift packaging ready for a personalised eCard"
                placeholderLabel="Add /home/gift-box.webp"
                sizes="(max-width: 768px) 90vw, 420px"
                aspectClassName="aspect-[5/4]"
              />
            </div>
            <div className="absolute -bottom-4 -left-2 rounded-2xl bg-white px-4 py-3 shadow-lg ring-1 ring-stone-200/80 sm:-left-4">
              <p className="text-xs font-semibold text-stone-800">Buy on Hommly.sg</p>
              <p className="text-[11px] text-stone-500">Personalise on Hommly.online</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
