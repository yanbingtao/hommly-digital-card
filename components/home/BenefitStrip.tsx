import { Lock, MessageSquareHeart, Smartphone, Zap } from 'lucide-react';
import { LANDING_MAX_WIDTH } from './constants';
import { cn } from '@/lib/utils';

const BENEFITS = [
  {
    icon: Smartphone,
    title: 'No app required',
    description: 'Works on any device',
  },
  {
    icon: Zap,
    title: 'Instant surprise',
    description: 'Scan and reveal',
  },
  {
    icon: MessageSquareHeart,
    title: 'Your message, your way',
    description: 'Photos, text & themes',
  },
  {
    icon: Lock,
    title: 'Privacy first',
    description: 'Secure & reliable',
  },
];

export function BenefitStrip() {
  return (
    <section aria-label="Key benefits" className="border-y border-stone-200/70 bg-white px-4 py-8 sm:px-6">
      <div className={cn('mx-auto', LANDING_MAX_WIDTH)}>
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
          {BENEFITS.map((item) => (
            <li key={item.title} className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-stone-100 text-stone-600">
                <item.icon className="h-4.5 w-4.5 h-[18px] w-[18px]" aria-hidden />
              </span>
              <div>
                <p className="text-sm font-semibold text-stone-900">{item.title}</p>
                <p className="mt-0.5 text-sm text-stone-500">{item.description}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
