import { ExternalLink } from 'lucide-react';
import { SHOP_URL } from './constants';

export function FinalCta() {
  return (
    <section className="px-4 py-24 sm:px-6 sm:py-32">
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] bg-gradient-to-br from-rose-500 via-orange-500 to-amber-500 px-8 py-20 text-center shadow-2xl shadow-orange-300/40 sm:px-16 sm:py-24">
        <div
          aria-hidden
          className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-20 -right-20 h-64 w-64 rounded-full bg-white/10 blur-3xl"
        />

        <div className="relative">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight text-white sm:text-4xl lg:text-5xl">
            Every gift tells a story.
            <br />
            <span className="text-white/90">Let&apos;s make yours unforgettable.</span>
          </h2>

          <a
            href={SHOP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-10 inline-flex items-center gap-2 rounded-full bg-white px-8 py-4 text-sm font-semibold text-stone-900 shadow-lg transition hover:bg-stone-50"
          >
            Shop Gifts on Hommly
            <ExternalLink className="h-4 w-4" aria-hidden />
          </a>
        </div>
      </div>
    </section>
  );
}

export function LandingFooter() {
  return (
    <footer className="border-t border-stone-200/80 bg-white px-4 py-10 text-center sm:px-6">
      <p className="text-sm text-stone-500">
        Made with love by{' '}
        <a
          href={SHOP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-stone-700 transition hover:text-rose-600"
        >
          Hommly.sg
        </a>
      </p>
    </footer>
  );
}
