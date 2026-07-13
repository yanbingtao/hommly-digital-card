import { ArrowDown, ExternalLink } from 'lucide-react';
import { SHOP_URL } from './constants';

function GiftVisual() {
  return (
    <div className="flex flex-col items-center">
      <div className="relative flex h-28 w-28 items-center justify-center rounded-3xl bg-gradient-to-br from-amber-100 to-orange-100 shadow-lg shadow-amber-100/80 ring-1 ring-amber-200/50">
        <span className="text-5xl" aria-hidden>🎁</span>
      </div>
      <p className="mt-3 text-sm font-medium text-stone-600">Gift</p>
    </div>
  );
}

function QrCardVisual() {
  return (
    <div className="flex flex-col items-center">
      <div className="flex h-28 w-28 flex-col items-center justify-center rounded-3xl bg-white shadow-lg shadow-stone-200/60 ring-1 ring-stone-200/80">
        <div className="grid grid-cols-4 gap-0.5 rounded-lg bg-stone-50 p-2" aria-hidden>
          {Array.from({ length: 16 }).map((_, i) => (
            <span
              key={i}
              className={`h-2.5 w-2.5 rounded-sm ${i % 3 === 0 ? 'bg-stone-800' : 'bg-stone-300'}`}
            />
          ))}
        </div>
        <p className="mt-2 text-[9px] font-semibold uppercase tracking-widest text-stone-400">QR Card</p>
      </div>
      <p className="mt-3 text-sm font-medium text-stone-600">QR Card</p>
    </div>
  );
}

function PhoneVisual() {
  return (
    <div className="flex flex-col items-center">
      <div className="w-[140px] rounded-[1.75rem] bg-stone-900 p-1.5 shadow-2xl shadow-stone-300/50 ring-1 ring-stone-800">
        <div className="overflow-hidden rounded-[1.4rem] bg-gradient-to-b from-amber-50 via-rose-50 to-orange-50">
          <div className="px-3 py-4 text-center">
            <span className="text-2xl" aria-hidden>🎉</span>
            <p className="mt-2 text-[10px] font-semibold leading-tight text-stone-700">
              Happy Birthday!
            </p>
            <p className="mt-1.5 text-[8px] leading-relaxed text-stone-500">
              A message made just for you...
            </p>
            <div className="mx-auto mt-2 flex justify-center gap-0.5">
              {[0, 1, 2].map((i) => (
                <span key={i} className="h-1 w-1 rounded-full bg-rose-300" />
              ))}
            </div>
          </div>
        </div>
      </div>
      <p className="mt-3 text-sm font-medium text-stone-600">Animated eCard</p>
    </div>
  );
}

function FlowArrow() {
  return (
    <div className="flex items-center justify-center text-stone-300" aria-hidden>
      <ArrowDown className="h-5 w-5 lg:hidden" />
      <span className="hidden text-xl lg:inline">→</span>
    </div>
  );
}

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-white px-4 pb-20 pt-16 sm:px-6 sm:pb-28 sm:pt-20">
      <div
        aria-hidden
        className="pointer-events-none absolute -left-32 top-0 h-96 w-96 rounded-full bg-rose-100/40 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 top-20 h-80 w-80 rounded-full bg-amber-100/50 blur-3xl"
      />

      <div className="relative mx-auto grid max-w-6xl items-center gap-16 lg:grid-cols-2 lg:gap-12">
        <div>
          <p className="mb-6 inline-flex items-center rounded-full border border-rose-100 bg-rose-50/80 px-4 py-1.5 text-xs font-medium tracking-wide text-rose-600">
            Hommly eCard · Free with selected gifts
          </p>

          <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight text-stone-900 sm:text-5xl lg:text-[3.25rem]">
            Give more
            <br />
            <span className="bg-gradient-to-r from-rose-500 via-orange-500 to-amber-500 bg-clip-text text-transparent">
              than a gift.
            </span>
          </h1>

          <p className="mt-6 max-w-lg text-lg leading-relaxed text-stone-500">
            Surprise someone with a personalised digital message that opens with a simple QR scan.
          </p>

          <ul className="mt-8 space-y-2.5">
            {['Personal message', 'Photos', 'Beautiful animations', 'Free with selected Hommly gifts'].map(
              (item) => (
                <li key={item} className="flex items-center gap-2.5 text-sm text-stone-600">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400" />
                  {item}
                </li>
              )
            )}
          </ul>

          <div className="mt-10 flex flex-wrap gap-3">
            <a
              href={SHOP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-stone-900 px-7 py-3.5 text-sm font-medium text-white shadow-lg shadow-stone-900/20 transition hover:bg-stone-800"
            >
              Shop Gifts
              <ExternalLink className="h-4 w-4" aria-hidden />
            </a>
            <a
              href="#how-it-works"
              className="inline-flex items-center rounded-full border border-stone-200 bg-white px-7 py-3.5 text-sm font-medium text-stone-700 transition hover:border-stone-300 hover:bg-stone-50"
            >
              See How It Works
            </a>
          </div>
        </div>

        <div className="flex justify-center lg:justify-end">
          <div className="rounded-[2rem] bg-gradient-to-br from-stone-50 to-rose-50/50 p-8 shadow-xl shadow-stone-200/40 ring-1 ring-stone-100 sm:p-10">
            <div className="flex flex-col items-center gap-4 lg:flex-row lg:gap-6">
              <GiftVisual />
              <FlowArrow />
              <QrCardVisual />
              <FlowArrow />
              <PhoneVisual />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
