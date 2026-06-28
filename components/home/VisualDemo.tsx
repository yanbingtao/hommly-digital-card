export function VisualDemo() {
  return (
    <section className="px-4 pb-20 sm:px-6" aria-label="Digital surprise card demo">
      <div className="mx-auto max-w-6xl">
        <div className="relative rounded-[2rem] bg-gradient-to-br from-white via-[#fff9f4] to-rose-50 p-6 shadow-xl shadow-stone-200/40 ring-1 ring-stone-200/60 sm:p-10 lg:p-14">
          <div className="grid items-center gap-10 lg:grid-cols-[1fr_auto_1fr_auto_1.1fr] lg:gap-6">
            {/* Physical gift */}
            <div className="flex flex-col items-center text-center">
              <div className="relative flex h-40 w-36 items-end justify-center rounded-3xl bg-gradient-to-b from-amber-100 to-amber-200/80 p-4 shadow-md ring-1 ring-amber-200/80">
                <div className="absolute -top-3 h-8 w-24 rounded-t-full bg-rose-300/80" aria-hidden />
                <div className="mb-2 flex h-24 w-full items-center justify-center rounded-2xl bg-white/70 shadow-inner">
                  <span className="text-5xl" aria-hidden>
                    🎁
                  </span>
                </div>
              </div>
              <p className="mt-4 text-sm font-medium text-stone-700">Thoughtful gift</p>
            </div>

            <div className="hidden text-2xl text-stone-300 lg:block" aria-hidden>
              +
            </div>

            {/* QR card */}
            <div className="flex flex-col items-center text-center">
              <div className="flex h-40 w-36 flex-col items-center justify-center rounded-3xl bg-white p-4 shadow-md ring-1 ring-stone-200/80">
                <div className="grid grid-cols-4 gap-1 rounded-lg bg-stone-100 p-2" aria-hidden>
                  {Array.from({ length: 16 }).map((_, i) => (
                    <span
                      key={i}
                      className={`h-3 w-3 rounded-sm ${i % 3 === 0 ? 'bg-stone-700' : 'bg-stone-300'}`}
                    />
                  ))}
                </div>
                <p className="mt-3 text-[10px] font-medium uppercase tracking-wider text-stone-500">
                  Scan me
                </p>
              </div>
              <p className="mt-4 text-sm font-medium text-stone-700">QR surprise card</p>
            </div>

            <div className="hidden text-2xl text-stone-300 lg:block" aria-hidden>
              →
            </div>

            {/* Phone mockup */}
            <div className="flex flex-col items-center text-center lg:items-end">
              <div className="relative w-full max-w-[220px] rounded-[2rem] bg-stone-800 p-2 shadow-2xl ring-1 ring-stone-700">
                <div className="overflow-hidden rounded-[1.5rem] bg-gradient-to-b from-[#fff5f0] to-[#ffe8dc]">
                  <div className="border-b border-rose-100/80 px-4 py-3 text-center">
                    <p className="text-[10px] font-medium text-rose-500">A little surprise</p>
                  </div>
                  <div className="space-y-3 px-4 py-5">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-2xl shadow-sm">
                      ✨
                    </div>
                    <p className="text-xs font-semibold leading-snug text-stone-700">
                      A heartfelt message, just for you
                    </p>
                    <div className="h-16 rounded-xl bg-white/80 shadow-inner" />
                    <div className="mx-auto h-2 w-16 rounded-full bg-rose-400/80" />
                  </div>
                </div>
              </div>
              <p className="mt-4 text-sm font-medium text-stone-700 lg:text-right">
                Animated digital card
              </p>
            </div>
          </div>

          <p className="mt-10 text-center text-sm text-stone-500">
            A physical gift, a QR moment, and a personal message — all in one thoughtful experience.
          </p>
        </div>
      </div>
    </section>
  );
}
