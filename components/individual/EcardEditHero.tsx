import { BrandLogo } from '@/components/BrandLogo';
import { cn } from '@/lib/utils';

/** Swap this path to change the hero background without touching layout. */
export const ECARD_EDIT_HERO_IMAGE = '/ecard-hero.jpg';

type EcardEditHeroProps = {
  className?: string;
};

/**
 * Full-bleed branded intro for the individual eCard edit workflow.
 * Overlay / text tokens are CSS variables on `.ecard-edit-hero` for easy tuning.
 */
export function EcardEditHero({ className }: EcardEditHeroProps) {
  return (
    <section
      className={cn('ecard-edit-hero relative w-full overflow-hidden', className)}
      aria-labelledby="ecard-edit-hero-heading"
    >
      <div
        className="ecard-edit-hero__bg absolute inset-0"
        style={{ backgroundImage: `url('${ECARD_EDIT_HERO_IMAGE}')` }}
        aria-hidden="true"
      />
      <div className="ecard-edit-hero__overlay absolute inset-0" aria-hidden="true" />

      <div className="relative mx-auto flex h-[200px] w-full max-w-[800px] flex-col justify-center px-4 py-8 sm:h-[260px] sm:px-6 sm:py-10">
        <div className="mb-3 flex items-center gap-2.5 sm:mb-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/92 shadow-sm shadow-stone-900/10 sm:h-10 sm:w-10">
            <BrandLogo
              href={null}
              showText={false}
              className="gap-0"
              imageClassName="h-6 w-6 sm:h-7 sm:w-7"
            />
          </div>
          <span className="ecard-edit-hero__eyebrow text-[11px] font-medium uppercase tracking-[0.16em]">
            Hommly eCards
          </span>
        </div>

        <h1
          id="ecard-edit-hero-heading"
          className="ecard-edit-hero__title max-w-2xl text-[1.65rem] font-semibold leading-tight tracking-tight sm:text-[2.15rem]"
        >
          Make your Hommly gifts more personal
        </h1>
        <p className="ecard-edit-hero__subtitle mt-2 max-w-xl text-[15px] leading-relaxed sm:mt-3 sm:text-base">
          Add a message to each eCard, or select multiple gifts to edit them together.
        </p>
      </div>
    </section>
  );
}
