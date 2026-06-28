import { ExternalLink } from 'lucide-react';

const SHOP_URL = 'https://hommly.sg';

export function FinalCta() {
  return (
    <section className="px-4 pb-24 pt-8 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <div className="rounded-[2rem] bg-gradient-to-br from-rose-500 via-rose-500 to-amber-500 px-6 py-14 text-center shadow-xl shadow-rose-200/50 sm:px-12">
          <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Ready to send something thoughtful?
          </h2>
          <a
            href={SHOP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-8 inline-flex items-center justify-center gap-2 rounded-full bg-white px-8 py-3.5 text-base font-medium text-rose-600 shadow-lg transition hover:bg-rose-50"
          >
            Visit Hommly.sg
            <ExternalLink className="h-4 w-4" aria-hidden />
          </a>
          <p className="mt-5 text-sm text-rose-100">
            Digital surprise cards are available for selected Hommly gift orders.
          </p>
        </div>
      </div>
    </section>
  );
}

export function LandingFooter() {
  return (
    <footer className="border-t border-stone-200/80 bg-white/60 px-4 py-8 text-center sm:px-6">
      <p className="text-sm text-stone-500">
        Made with love by{' '}
        <a
          href="https://hommly.sg"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-stone-700 transition hover:text-rose-600"
        >
          Hommly.sg
        </a>{' '}
        ❤️
      </p>
    </footer>
  );
}
