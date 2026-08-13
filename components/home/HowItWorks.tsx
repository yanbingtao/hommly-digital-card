import { Gift, PencilLine, QrCode, Sparkles } from 'lucide-react';
import { LANDING_MAX_WIDTH } from './constants';
import { cn } from '@/lib/utils';

const STEPS = [
  {
    icon: Gift,
    title: 'Choose a Gift',
    description: 'Pick any eligible gift on Hommly.sg.',
  },
  {
    icon: PencilLine,
    title: 'Personalise Online',
    description: 'Add your message, photo and choose your eCard style.',
  },
  {
    icon: QrCode,
    title: 'Recipient Scans QR',
    description: 'A QR card comes with the gift.',
  },
  {
    icon: Sparkles,
    title: 'Surprise!',
    description: 'Your eCard opens instantly.',
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-24 bg-[#fffaf7] px-4 py-16 sm:px-6 sm:py-24">
      <div className={cn('mx-auto', LANDING_MAX_WIDTH)}>
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-500">
            Simple process
          </p>
          <h2 className="mt-3 font-display text-3xl font-semibold leading-[1.25] tracking-[-0.02em] text-stone-900 sm:text-4xl sm:leading-[1.22]">
            How it works
          </h2>
          <p className="mt-3 text-base text-stone-500">
            From Hommly.sg gift to digital surprise — in four easy steps.
          </p>
        </div>

        <ol className="relative mt-12 grid gap-8 sm:mt-16 lg:grid-cols-4 lg:gap-5">
          <div
            aria-hidden
            className="absolute left-[12%] right-[12%] top-10 hidden h-px bg-gradient-to-r from-transparent via-rose-200 to-transparent lg:block"
          />

          {STEPS.map((step, index) => (
            <li key={step.title} className="relative flex flex-col items-center text-center lg:items-stretch lg:text-left">
              <div className="relative z-10 mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-white shadow-[0_12px_30px_-16px_rgba(28,25,23,0.35)] ring-1 ring-stone-200/80 lg:mx-0">
                <step.icon className="h-7 w-7 text-stone-700" aria-hidden />
                <span className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-rose-500 text-[11px] font-bold text-white">
                  {index + 1}
                </span>
              </div>
              <h3 className="mt-5 font-display text-lg font-semibold text-stone-900">{step.title}</h3>
              <p className="mt-1.5 max-w-[220px] text-sm leading-relaxed text-stone-500 lg:max-w-none">
                {step.description}
              </p>
              {index < STEPS.length - 1 ? (
                <span className="mt-4 text-rose-300 lg:hidden" aria-hidden>
                  ↓
                </span>
              ) : null}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
