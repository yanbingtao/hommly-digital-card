import { Heart, ImageIcon, Zap } from 'lucide-react';

const FEATURES = [
  {
    icon: Heart,
    title: 'Personal Message',
    description: "Write a heartfelt message they'll never forget.",
    gradient: 'from-rose-500 to-pink-500',
    bg: 'from-rose-50 to-pink-50',
  },
  {
    icon: ImageIcon,
    title: 'Photos & Memories',
    description: 'Upload photos to make every gift more meaningful.',
    gradient: 'from-violet-500 to-purple-500',
    bg: 'from-violet-50 to-purple-50',
  },
  {
    icon: Zap,
    title: 'Instant Surprise',
    description: 'The recipient scans the QR code and instantly sees your digital surprise.',
    gradient: 'from-amber-500 to-orange-500',
    bg: 'from-amber-50 to-orange-50',
  },
];

export function WhyLoveSection() {
  return (
    <section className="bg-stone-50 px-4 py-24 sm:px-6 sm:py-32">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-medium uppercase tracking-widest text-stone-400">Why People Love It</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">
            Why people love Hommly eCard
          </h2>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-3 sm:gap-8">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className={`group rounded-3xl bg-gradient-to-br ${feature.bg} p-8 ring-1 ring-white/80 transition hover:shadow-lg hover:shadow-stone-200/50`}
            >
              <div
                className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${feature.gradient} shadow-md`}
              >
                <feature.icon className="h-5 w-5 text-white" aria-hidden />
              </div>
              <h3 className="mt-6 text-lg font-semibold text-stone-900">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-stone-500">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
