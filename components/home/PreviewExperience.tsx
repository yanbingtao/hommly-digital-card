import { Check } from 'lucide-react';

const HIGHLIGHTS = [
  'Personal message',
  'Photos',
  'Beautiful animation',
  'No app required',
];

function PhoneMockup() {
  return (
    <div className="relative mx-auto w-[280px] sm:w-[300px]">
      <div
        aria-hidden
        className="absolute -inset-8 rounded-full bg-gradient-to-br from-rose-200/40 via-amber-100/30 to-violet-200/30 blur-2xl"
      />
      <div className="relative rounded-[2.5rem] bg-stone-900 p-2.5 shadow-2xl shadow-stone-400/30 ring-1 ring-stone-800">
        <div className="overflow-hidden rounded-[2rem] bg-gradient-to-b from-amber-50 via-white to-rose-50">
          <div className="border-b border-stone-100/80 px-5 py-3 text-center">
            <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400">Hommly eCard</p>
          </div>
          <div className="px-6 py-8 text-center">
            <span className="text-4xl" aria-hidden>🎂</span>
            <h3 className="mt-4 text-lg font-semibold text-stone-800">Happy Birthday!</h3>
            <p className="mt-3 text-sm leading-relaxed text-stone-500">
              Wishing you a day filled with joy, laughter, and all the things that make you smile.
            </p>
            <div className="mx-auto mt-5 h-24 w-full overflow-hidden rounded-xl bg-gradient-to-br from-rose-100 to-amber-100 ring-1 ring-rose-100/80">
              <div className="flex h-full items-center justify-center">
                <span className="text-3xl opacity-60" aria-hidden>📷</span>
              </div>
            </div>
            <div className="mt-4 flex justify-center gap-1">
              {[0, 1, 2, 3, 4].map((i) => (
                <span
                  key={i}
                  className="h-1.5 w-1.5 rounded-full bg-rose-300"
                  style={{ opacity: 1 - i * 0.15 }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PreviewExperience() {
  return (
    <section id="preview" className="bg-stone-50 px-4 py-24 sm:px-6 sm:py-32">
      <div className="mx-auto max-w-6xl">
        <div className="grid items-center gap-16 lg:grid-cols-2 lg:gap-20">
          <PhoneMockup />

          <div>
            <p className="text-sm font-medium uppercase tracking-widest text-stone-400">Recipient Experience</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">
              Preview the experience
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-stone-500">
              The recipient simply scans the QR code and instantly opens your personalised digital surprise.
            </p>

            <ul className="mt-8 space-y-4">
              {HIGHLIGHTS.map((item) => (
                <li key={item} className="flex items-center gap-3 text-stone-700">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100">
                    <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
                  </span>
                  <span className="text-sm font-medium">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
