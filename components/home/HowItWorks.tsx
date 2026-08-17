import type { ReactNode } from 'react';
import Image from 'next/image';
import {
  Eye,
  Globe,
  Instagram,
  Lock,
  MessageCircle,
  Music2,
  PencilLine,
} from 'lucide-react';
import { HommlyCta } from '@/components/home/HommlyCta';
import { HomeAssetImage } from '@/components/home/HomeAssetImage';
import { HOME_ASSETS, type HomeAssetAvailability } from '@/lib/home-asset-paths';
import { LANDING_MAX_WIDTH, SHOP_URL } from './constants';
import { cn } from '@/lib/utils';

type HowItWorksProps = {
  assets: HomeAssetAvailability;
};

function StepNumber({ n }: { n: string }) {
  return (
    <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-white px-2 text-[11px] font-semibold tabular-nums tracking-wide text-rose-600 ring-1 ring-rose-100">
      {n}
    </span>
  );
}

function RoleLabel({
  children,
  tone,
}: {
  children: ReactNode;
  tone: 'edit' | 'view';
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]',
        tone === 'edit'
          ? 'bg-stone-900 text-white'
          : 'bg-rose-500 text-white'
      )}
    >
      {tone === 'edit' ? (
        <PencilLine className="h-3 w-3 opacity-90" aria-hidden />
      ) : (
        <Eye className="h-3 w-3 opacity-90" aria-hidden />
      )}
      {children}
    </span>
  );
}

function StepVisualGift({ available }: { available: boolean }) {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[160px] overflow-hidden rounded-2xl bg-[#fff1eb] ring-1 ring-rose-100/80">
      <HomeAssetImage
        src={HOME_ASSETS.giftBox}
        available={available}
        alt="Hommly gift"
        placeholderLabel="gift-box.webp"
        sizes="160px"
        aspectClassName="aspect-square"
        className="rounded-2xl"
        imageClassName="object-cover object-center"
      />
    </div>
  );
}

function StepVisualEditAccess({ qrAvailable }: { qrAvailable: boolean }) {
  return (
    <div className="relative mx-auto flex w-full max-w-[180px] flex-col items-center gap-3">
      <div className="relative w-[72%] overflow-hidden rounded-xl bg-white p-1.5 shadow-sm ring-1 ring-stone-200/80">
        {qrAvailable ? (
          <div className="relative aspect-square w-full overflow-hidden rounded-lg">
            <Image
              src={HOME_ASSETS.qrCard}
              alt=""
              fill
              sizes="120px"
              className="object-cover"
              aria-hidden
            />
          </div>
        ) : (
          <div
            className="grid aspect-square grid-cols-5 gap-[3px] rounded-lg bg-stone-50 p-2"
            aria-hidden
          >
            {Array.from({ length: 25 }).map((_, i) => (
              <span
                key={i}
                className={cn(
                  'rounded-[2px]',
                  [0, 1, 2, 4, 5, 6, 10, 12, 14, 18, 20, 21, 22, 24].includes(i)
                    ? 'bg-stone-800'
                    : 'bg-stone-300'
                )}
              />
            ))}
          </div>
        )}
      </div>
      <div
        className="flex items-center gap-2 rounded-full bg-white px-3 py-1.5 shadow-sm ring-1 ring-stone-200/80"
        aria-hidden
      >
        <Lock className="h-3.5 w-3.5 text-stone-500" />
        <span className="font-mono text-xs tracking-[0.35em] text-stone-500">••••••</span>
      </div>
    </div>
  );
}

function StepVisualPersonalise() {
  return (
    <div className="relative mx-auto w-full max-w-[130px]">
      <div className="rounded-[1.35rem] bg-stone-900 p-[7px] shadow-sm ring-1 ring-stone-800">
        <div className="overflow-hidden rounded-[1.05rem] bg-gradient-to-b from-[#fff7f2] via-white to-[#ffe8dc] px-3 pb-3 pt-2.5 text-center">
          <div className="mx-auto h-1 w-10 rounded-full bg-stone-800/70" aria-hidden />
          <p className="mt-2 text-[8px] font-semibold uppercase tracking-[0.18em] text-rose-500">
            Hommly eCard
          </p>
          <div className="mx-auto mt-2 h-10 w-full rounded-md bg-gradient-to-br from-rose-100 via-amber-50 to-orange-100 ring-1 ring-rose-100" />
          <div className="mx-auto mt-2 space-y-1">
            <div className="mx-auto h-1 w-14 rounded-full bg-stone-300/90" />
            <div className="mx-auto h-1 w-10 rounded-full bg-stone-200" />
          </div>
          <div className="mt-2.5 flex justify-center gap-1.5" aria-hidden>
            {[MessageCircle, Instagram, Music2, Globe].map((Icon, i) => (
              <span
                key={i}
                className="flex h-5 w-5 items-center justify-center rounded-full bg-white/85 text-stone-500 ring-1 ring-stone-200/70"
              >
                <Icon className="h-2.5 w-2.5" />
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StepVisualSurprise({ qrAvailable }: { qrAvailable: boolean }) {
  return (
    <div className="relative mx-auto flex w-full max-w-[170px] items-end justify-center gap-2">
      <div className="mb-1 w-[42%] overflow-hidden rounded-xl bg-white p-1 shadow-sm ring-1 ring-rose-100">
        {qrAvailable ? (
          <div className="relative aspect-square w-full overflow-hidden rounded-lg">
            <Image
              src={HOME_ASSETS.qrCard}
              alt=""
              fill
              sizes="80px"
              className="object-cover"
              aria-hidden
            />
          </div>
        ) : (
          <div className="aspect-square rounded-lg bg-stone-100" aria-hidden />
        )}
      </div>
      <div className="w-[48%] rounded-[1.2rem] bg-stone-900 p-[6px] shadow-sm ring-1 ring-stone-800">
        <div className="overflow-hidden rounded-[0.95rem] bg-gradient-to-b from-rose-50 to-[#fff1eb] px-2 pb-2.5 pt-2 text-center">
          <div className="mx-auto h-0.5 w-8 rounded-full bg-stone-800/70" aria-hidden />
          <p className="mt-1.5 text-[7px] font-semibold uppercase tracking-[0.16em] text-rose-500">
            Opened
          </p>
          <p className="mt-1 font-display text-[11px] font-semibold leading-tight text-stone-800">
            Your eCard
          </p>
          <div className="mx-auto mt-1.5 h-8 w-full rounded-md bg-gradient-to-br from-rose-200/80 to-amber-100" />
        </div>
      </div>
    </div>
  );
}

export function HowItWorks({ assets }: HowItWorksProps) {
  const steps = [
    {
      n: '01',
      title: 'Choose Your Gift',
      description: 'Pick an eligible gift from Hommly.sg.',
      role: null as null | { label: string; tone: 'edit' | 'view' },
      visual: <StepVisualGift available={assets.giftBox} />,
      emphasize: false,
    },
    {
      n: '02',
      title: 'Scan & Verify',
      description:
        'Scan the Edit QR provided with your order, then enter your 6-digit Edit PIN.',
      role: { label: 'Edit QR · For you', tone: 'edit' as const },
      visual: <StepVisualEditAccess qrAvailable={assets.qrCard} />,
      emphasize: true,
    },
    {
      n: '03',
      title: 'Make It Yours',
      description:
        'Add your message, photo, eCard style, social & web links, and optional Viewing PIN.',
      role: null,
      visual: <StepVisualPersonalise />,
      emphasize: false,
    },
    {
      n: '04',
      title: 'Send & Surprise',
      description:
        'The View QR stays with the gift. Your recipient scans it to open the eCard instantly — no app required.',
      role: { label: 'View QR · For recipient', tone: 'view' as const },
      visual: <StepVisualSurprise qrAvailable={assets.qrCard} />,
      emphasize: true,
    },
  ];

  return (
    <section
      id="how-it-works"
      className="scroll-mt-24 bg-[linear-gradient(180deg,#fff6f1_0%,#fffaf7_45%,#fff8f4_100%)] px-4 py-16 sm:px-6 sm:py-24"
    >
      <div className={cn('mx-auto', LANDING_MAX_WIDTH)}>
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-500">
            How it works
          </p>
          <h2 className="mt-3 font-display text-3xl font-semibold leading-[1.25] tracking-[-0.02em] text-stone-900 sm:text-4xl sm:leading-[1.22]">
            From gift to eCard in four simple steps
          </h2>
          <p className="mt-3 text-base text-stone-500">
            A simple flow for you, and an effortless surprise for them.
          </p>
        </div>

        {/* Desktop: connected horizontal journey */}
        <ol className="relative mt-14 hidden lg:grid lg:grid-cols-4 lg:gap-6">
          <div
            aria-hidden
            className="pointer-events-none absolute left-[12%] right-[12%] top-[4.75rem] h-px bg-gradient-to-r from-transparent via-rose-200 to-transparent"
          />
          {steps.map((step, index) => (
            <li
              key={step.n}
              className={cn(
                'relative flex flex-col items-center text-center motion-safe:animate-hommly-rise',
                step.emphasize && 'z-[1]'
              )}
              style={{ animationDelay: `${index * 80}ms` }}
            >
              <div className="relative z-10 mb-5 flex h-[168px] w-full items-center justify-center">
                {step.visual}
              </div>
              <StepNumber n={step.n} />
              {step.role ? (
                <div className="mt-3">
                  <RoleLabel tone={step.role.tone}>{step.role.label}</RoleLabel>
                </div>
              ) : (
                <div className="mt-3 h-6" aria-hidden />
              )}
              <h3 className="mt-3 font-display text-xl font-semibold tracking-[-0.02em] text-stone-900">
                {step.title}
              </h3>
              <p className="mt-2 max-w-[240px] text-sm leading-relaxed text-stone-500">
                {step.description}
              </p>
              {index < steps.length - 1 ? (
                <span
                  aria-hidden
                  className="pointer-events-none absolute -right-3 top-[4.55rem] text-rose-300"
                >
                  →
                </span>
              ) : null}
            </li>
          ))}
        </ol>

        {/* Mobile / tablet: vertical timeline */}
        <ol className="relative mt-12 space-y-0 lg:hidden">
          <div
            aria-hidden
            className="absolute bottom-6 left-[1.15rem] top-6 w-px bg-gradient-to-b from-rose-200 via-rose-200/80 to-transparent"
          />
          {steps.map((step) => (
            <li key={step.n} className="relative grid grid-cols-[2.3rem_minmax(0,1fr)] gap-4 pb-10 last:pb-0">
              <div className="relative z-10 flex justify-center pt-1">
                <StepNumber n={step.n} />
              </div>
              <div
                className={cn(
                  'rounded-2xl bg-white/80 p-4 ring-1 ring-stone-200/70',
                  step.emphasize && 'ring-rose-100'
                )}
              >
                <div className="mb-4 flex justify-center sm:mb-5">{step.visual}</div>
                {step.role ? (
                  <div className="mb-2">
                    <RoleLabel tone={step.role.tone}>{step.role.label}</RoleLabel>
                  </div>
                ) : null}
                <h3 className="font-display text-lg font-semibold tracking-[-0.02em] text-stone-900">
                  {step.title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-stone-500">{step.description}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-10 flex justify-center sm:mt-12">
          <HommlyCta href={SHOP_URL} variant="primary" external>
            Explore Hommly Gifts
          </HommlyCta>
        </div>
      </div>
    </section>
  );
}
