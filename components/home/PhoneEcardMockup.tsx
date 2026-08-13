import { cn } from '@/lib/utils';

type PhoneEcardMockupProps = {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
};

const SIZE = {
  sm: 'w-[180px] sm:w-[200px]',
  md: 'w-[240px] sm:w-[270px]',
  lg: 'w-[260px] sm:w-[300px]',
} as const;

/**
 * CSS phone frame mirroring the recipient Hommly eCard UI.
 * Uses structured HTML/CSS only — no static screenshot dependency.
 */
export function PhoneEcardMockup({ className, size = 'md' }: PhoneEcardMockupProps) {
  return (
    <div className={cn('relative mx-auto', SIZE[size], className)}>
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-10 rounded-full bg-[radial-gradient(circle_at_center,rgba(251,113,133,0.22),transparent_65%)] blur-2xl motion-safe:animate-hommly-glow"
      />
      <div className="relative rounded-[2.35rem] bg-stone-900 p-[9px] shadow-[0_28px_60px_-24px_rgba(28,25,23,0.55)] ring-1 ring-stone-800">
        <div className="relative overflow-hidden rounded-[1.9rem] bg-gradient-to-b from-[#fff7f2] via-white to-[#ffe8dc]">
          <div className="mx-auto mt-2.5 h-1 w-16 rounded-full bg-stone-800/80" aria-hidden />
          <div className="border-b border-rose-100/70 px-5 py-3 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-rose-500/90">
              Hommly eCard
            </p>
          </div>
          <div className="px-5 pb-7 pt-6 text-center">
            <span className="text-3xl" aria-hidden>
              🎂
            </span>
            <p className="mt-3 font-display text-xl font-semibold tracking-tight text-stone-800">
              Happy Birthday!
            </p>
            <p className="mt-2 text-[12px] leading-relaxed text-stone-500">
              Wishing you a day filled with joy — and a little surprise from us.
            </p>
            {/* Decorative photo panel — UI chrome, not a product photo */}
            <div
              className="relative mx-auto mt-4 flex h-28 w-full items-end overflow-hidden rounded-xl bg-gradient-to-br from-rose-100 via-amber-50 to-orange-100 ring-1 ring-rose-100"
              aria-hidden
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.65),transparent_45%)]" />
              <div className="relative w-full bg-gradient-to-t from-stone-900/20 to-transparent px-3 pb-2 pt-6">
                <div className="h-1.5 w-16 rounded-full bg-white/70" />
              </div>
            </div>
            <div className="mt-4 flex justify-center gap-1.5" aria-hidden>
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className={cn('h-1.5 w-1.5 rounded-full', i === 0 ? 'bg-rose-400' : 'bg-rose-200')}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
