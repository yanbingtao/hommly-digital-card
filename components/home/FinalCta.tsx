import Image from 'next/image';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { BrandLogo } from '@/components/BrandLogo';
import { HommlyCta } from '@/components/home/HommlyCta';
import { HOME_ASSETS, type HomeAssetAvailability } from '@/lib/home-assets';
import {
  HOMMLY_CONTACT_URL,
  HOMMLY_ECARD_EMAIL,
  HOMMLY_ECARD_MAILTO,
  HOMMLY_PRIVACY_URL,
  HOMMLY_TERMS_URL,
  LANDING_MAX_WIDTH,
  SHOP_URL,
} from './constants';
import { cn } from '@/lib/utils';

const footerLinkClass =
  'inline-flex min-h-11 items-center text-sm text-stone-600 transition-colors duration-200 hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300/60 sm:min-h-0';

const footerHeadingClass =
  'text-xs font-semibold uppercase tracking-[0.18em] text-stone-400';

type FinalCtaProps = {
  assets: HomeAssetAvailability;
};

export function FinalCta({ assets }: FinalCtaProps) {
  return (
    <section className="px-4 py-16 sm:px-6 sm:py-24">
      <div className={cn('mx-auto', LANDING_MAX_WIDTH)}>
        <div
          className={cn(
            'relative overflow-hidden rounded-[2rem] px-6 py-12 shadow-[0_30px_60px_-28px_rgba(28,25,23,0.35)] sm:px-10 sm:py-14 lg:min-h-[360px] lg:px-14 lg:py-16',
            !assets.finalCta &&
              'bg-gradient-to-br from-rose-500 via-[#f97366] to-orange-400 shadow-[0_30px_60px_-28px_rgba(244,63,94,0.55)]'
          )}
        >
          {assets.finalCta ? (
            <>
              <Image
                src={HOME_ASSETS.finalCta}
                alt=""
                fill
                sizes="(max-width: 1200px) 100vw, 1200px"
                className="object-cover object-[72%_center] sm:object-[68%_center] lg:object-center"
                aria-hidden
              />
              {/* Brand pink fade so HTML copy stays readable over the photo */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(244,63,94,0.78)_0%,rgba(244,63,94,0.52)_48%,rgba(244,63,94,0.72)_100%)] sm:bg-[linear-gradient(90deg,rgba(244,63,94,0.88)_0%,rgba(244,63,94,0.62)_38%,rgba(255,77,103,0.22)_66%,transparent_84%)]"
              />
            </>
          ) : (
            <>
              <div
                aria-hidden
                className="pointer-events-none absolute -left-16 top-0 h-56 w-56 rounded-full bg-white/15 blur-3xl"
              />
              <div
                aria-hidden
                className="pointer-events-none absolute -bottom-20 -right-10 h-64 w-64 rounded-full bg-amber-200/30 blur-3xl"
              />
            </>
          )}

          <div className="relative max-w-xl">
            <h2 className="font-display text-3xl font-semibold leading-[1.25] tracking-[-0.02em] text-white sm:text-4xl sm:leading-[1.22] lg:text-[2.75rem] lg:leading-[1.2]">
              Ready to make your gift more personal?
            </h2>
            <p className="mt-4 max-w-xl text-base text-white/90">
              Choose your gift on Hommly.sg and add a Hommly eCard.
            </p>
            <HommlyCta href={SHOP_URL} variant="inverse" external className="mt-8">
              Shop Gifts on Hommly.sg
            </HommlyCta>
          </div>
        </div>
      </div>
    </section>
  );
}

export function LandingFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-stone-200/70 bg-[#fff6f1] px-4 py-16 sm:px-6 sm:py-20">
      <div
        className={cn(
          'mx-auto grid gap-12 sm:grid-cols-2 lg:grid-cols-[1.3fr_0.7fr_0.75fr_1.1fr] lg:gap-10 xl:gap-14',
          LANDING_MAX_WIDTH
        )}
      >
        {/* Brand */}
        <div className="sm:col-span-2 lg:col-span-1">
          <BrandLogo />
          <p className="mt-5 max-w-xs text-sm leading-relaxed text-stone-600 sm:text-[15px]">
            Every gift tells a story.
            <br />
            Make yours personal.
          </p>
        </div>

        {/* Explore */}
        <div>
          <p className={footerHeadingClass}>Explore</p>
          <ul className="mt-4 space-y-1 sm:space-y-2.5">
            <li>
              <a href="#how-it-works" className={footerLinkClass}>
                How It Works
              </a>
            </li>
            <li>
              <Link href="/ecard" className={footerLinkClass}>
                eCard guide
              </Link>
            </li>
            <li>
              <a href="#preview" className={footerLinkClass}>
                Preview eCard
              </a>
            </li>
            <li>
              <a href="#faq" className={footerLinkClass}>
                FAQ
              </a>
            </li>
            <li>
              <a
                href={SHOP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(footerLinkClass, 'gap-1.5')}
              >
                Shop Gifts
                <ExternalLink className="h-3.5 w-3.5 opacity-70" aria-hidden />
              </a>
            </li>
          </ul>
        </div>

        {/* Help */}
        <div>
          <p className={footerHeadingClass}>Help</p>
          <ul className="mt-4 space-y-1 sm:space-y-2.5">
            <li>
              <a
                href={HOMMLY_PRIVACY_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(footerLinkClass, 'gap-1.5')}
              >
                Privacy Policy
                <ExternalLink className="h-3.5 w-3.5 opacity-70" aria-hidden />
              </a>
            </li>
            <li>
              <a
                href={HOMMLY_TERMS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(footerLinkClass, 'gap-1.5')}
              >
                Terms of Service
                <ExternalLink className="h-3.5 w-3.5 opacity-70" aria-hidden />
              </a>
            </li>
          </ul>
        </div>

        {/* Contact */}
        <div className="flex flex-col">
          <p className={footerHeadingClass}>Contact</p>
          <a
            href={HOMMLY_CONTACT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex min-h-11 w-fit items-center gap-1.5 text-sm font-semibold text-stone-700 transition-colors duration-200 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300/60 sm:min-h-0"
          >
            Contact Us
            <ExternalLink className="h-3.5 w-3.5 opacity-70" aria-hidden />
          </a>
          <p className="mt-5 text-sm font-medium text-stone-800">Need help with your eCard?</p>
          <a
            href={HOMMLY_ECARD_MAILTO}
            className="mt-2 inline-flex min-h-11 w-fit items-center text-sm font-semibold text-rose-600 transition-colors duration-200 hover:text-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300/60 sm:min-h-0"
          >
            {HOMMLY_ECARD_EMAIL}
          </a>
        </div>
      </div>

      <div
        className={cn(
          'mx-auto mt-14 border-t border-stone-200/80 pt-6 sm:mt-16',
          LANDING_MAX_WIDTH
        )}
      >
        <p className="text-xs text-stone-400">© {year} Hommly</p>
      </div>
    </footer>
  );
}
