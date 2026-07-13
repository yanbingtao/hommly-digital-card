import { Gift, Pencil, QrCode, Sparkles } from 'lucide-react';

const STEPS = [
  {
    icon: Gift,
    title: 'Choose Gift',
    description: 'Pick a gift from Hommly.',
    color: 'from-amber-400 to-orange-500',
  },
  {
    icon: Pencil,
    title: 'Personalise Online',
    description: 'Add your message and photos.',
    color: 'from-violet-400 to-purple-500',
  },
  {
    icon: QrCode,
    title: 'Recipient Scans QR',
    description: 'A QR card comes with the gift.',
    color: 'from-blue-400 to-cyan-500',
  },
  {
    icon: Sparkles,
    title: 'Surprise!',
    description: 'Your eCard opens instantly.',
    color: 'from-rose-400 to-pink-500',
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-white px-4 py-24 sm:px-6 sm:py-32">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-medium uppercase tracking-widest text-stone-400">Simple Process</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">
            How it works
          </h2>
        </div>

        <div className="relative mt-16">
          <div
            aria-hidden
            className="absolute left-0 right-0 top-10 hidden h-px bg-gradient-to-r from-transparent via-stone-200 to-transparent sm:block"
          />

          <ol className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
            {STEPS.map((step, index) => (
              <li key={step.title} className="relative flex flex-col items-center text-center">
                {index < STEPS.length - 1 && (
                  <span
                    aria-hidden
                    className="absolute -bottom-5 left-1/2 hidden h-6 w-px -translate-x-1/2 bg-stone-200 sm:block lg:hidden"
                  />
                )}

                <div
                  className={`relative z-10 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br ${step.color} shadow-lg shadow-stone-200/60`}
                >
                  <step.icon className="h-8 w-8 text-white" aria-hidden />
                  <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs font-bold text-stone-700 shadow-sm ring-1 ring-stone-100">
                    {index + 1}
                  </span>
                </div>

                <h3 className="mt-6 text-base font-semibold text-stone-900">{step.title}</h3>
                <p className="mt-1.5 max-w-[180px] text-sm text-stone-500">{step.description}</p>

                {index < STEPS.length - 1 && (
                  <span aria-hidden className="mt-4 text-stone-300 lg:hidden">
                    ↓
                  </span>
                )}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
