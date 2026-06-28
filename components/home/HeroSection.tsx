import { ExternalLink } from 'lucide-react';

const SHOP_URL = 'https://hommly.sg';

export function HeroSection() {
  return (
    <section className="relative overflow-hidden px-4 pb-16 pt-12 sm:px-6 sm:pb-24 sm:pt-16">
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 top-0 h-72 w-72 rounded-full bg-rose-100/60 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 top-24 h-64 w-64 rounded-full bg-amber-100/70 blur-3xl"
      />

      <div className="relative mx-auto max-w-6xl">
        <div className="mx-auto max-w-3xl text-center">
          <p className="mb-4 inline-flex items-center rounded-full bg-white/80 px-4 py-1.5 text-xs font-medium uppercase tracking-widest text-rose-600 shadow-sm ring-1 ring-rose-100">
            Digital Surprise Cards
          </p>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight text-stone-800 sm:text-5xl lg:text-6xl">
            Make every gift feel{' '}
            <span className="bg-gradient-to-r from-rose-500 to-amber-500 bg-clip-text text-transparent">
              more meaningful
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-stone-600 sm:text-lg">
            Make your Hommly gift extra meaningful with a digital surprise card — complete
            with a heartfelt message, photo, and animation that opens by QR code.
          </p>

          <div className="mt-10 flex justify-center">
            <a
              href={SHOP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-rose-500 px-8 py-3.5 text-base font-medium text-white shadow-lg shadow-rose-200/80 transition hover:bg-rose-600"
            >
              Shop Gifts on Hommly
              <ExternalLink className="h-4 w-4" aria-hidden />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
