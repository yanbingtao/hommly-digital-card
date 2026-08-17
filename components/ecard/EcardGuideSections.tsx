import Image from 'next/image';
import {
  ArrowDown,
  ArrowRight,
  Check,
  Eye,
  Gift,
  Heart,
  ImageIcon,
  Link2,
  Lock,
  MessageSquareHeart,
  Palette,
  PencilLine,
  QrCode,
  School,
  Sparkles,
  Users,
} from 'lucide-react';
import { HommlyCta } from '@/components/home/HommlyCta';
import {
  ECARD_AVAILABILITY_MONTHS,
  HOMMLY_ECARD_EMAIL,
  HOMMLY_ECARD_MAILTO,
  LANDING_MAX_WIDTH,
  SHOP_URL,
} from '@/components/home/constants';
import { cn } from '@/lib/utils';

/**
 * Screenshots for the three sender steps, in order. Replace the files in
 * /public/ecard/steps to update the visuals — no code change needed.
 */
const ECARD_STEP_IMAGES = [
  '/ecard/steps/step-1.webp',
  '/ecard/steps/step-2.webp',
  '/ecard/steps/step-3.webp',
] as const;

const sectionPad = 'px-4 py-16 sm:px-6 sm:py-24';
const displayHeading =
  'font-display font-semibold tracking-[-0.02em] text-[#55382D]';
const bodyText = 'text-[#6F625C]';

export function EcardHero() {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_12%_0%,rgba(252,232,228,0.9),transparent_52%),radial-gradient(ellipse_at_88%_8%,rgba(247,213,199,0.55),transparent_48%),radial-gradient(ellipse_at_70%_100%,rgba(221,234,246,0.45),transparent_45%),linear-gradient(180deg,#FFF9F5_0%,#FFF9F5_62%,#FFFFFF_100%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 top-24 h-40 w-40 rounded-full bg-[#F7E8A8]/35 blur-3xl motion-safe:animate-hommly-glow sm:top-32 sm:h-56 sm:w-56"
      />

      <div
        className={cn(
          'relative mx-auto flex min-h-[min(88vh,760px)] flex-col justify-center py-16 sm:py-20 lg:py-24',
          LANDING_MAX_WIDTH,
          'px-4 sm:px-6'
        )}
      >
        <div className="max-w-2xl motion-safe:animate-hommly-rise">
          <p className="font-display text-3xl font-semibold tracking-tight text-[#55382D] sm:text-4xl">
            Hommly
          </p>
          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.22em] text-[#DE7C72]">
            Digital eCard
          </p>

          <h1
            className={cn(
              displayHeading,
              'mt-6 text-[2.35rem] leading-[1.18] sm:text-5xl sm:leading-[1.15] lg:text-[3.35rem] lg:leading-[1.12]'
            )}
          >
            You scan to create.
            <br />
            They scan to view.
          </h1>

          <p className={cn(bodyText, 'mt-5 max-w-lg text-base leading-relaxed sm:text-lg')}>
            A personalised digital message attached to a physical Hommly gift —
            warm, simple, and memorable.
          </p>

          <div className="mt-7 flex flex-col gap-3.5 sm:mt-8 sm:flex-row sm:flex-wrap sm:gap-3.5">
            <HommlyCta href={SHOP_URL} variant="primary" external block className="sm:w-auto">
              Shop Hommly Gifts
            </HommlyCta>
            <HommlyCta
              href="#what-is"
              variant="secondary"
              icon={ArrowDown}
              iconMotion="down"
              block
              className="sm:w-auto"
            >
              Learn how it works
            </HommlyCta>
          </div>
        </div>

        <div
          aria-hidden
          className="pointer-events-none absolute bottom-10 right-4 hidden w-[min(42%,380px)] motion-safe:animate-hommly-float lg:block"
        >
          <div className="relative aspect-[4/5] overflow-hidden rounded-[2rem] bg-[#FCE8E4] shadow-[0_24px_50px_-28px_rgba(85,56,45,0.35)] ring-1 ring-[#E8D9D2]/80">
            <div className="absolute inset-0 bg-[linear-gradient(160deg,#FCE8E4_0%,#FFF9F5_48%,#DDEAF6_100%)]" />
            <div className="absolute inset-x-6 top-8 rounded-2xl bg-white/90 p-4 shadow-sm ring-1 ring-[#E8D9D2]/70">
              <div className="flex items-center gap-2 text-[#DE7C72]">
                <Heart className="h-4 w-4 fill-current" />
                <span className="text-xs font-semibold tracking-wide">Hommly eCard</span>
              </div>
              <p className="mt-3 font-display text-lg font-semibold text-[#55382D]">
                A little note that lasts.
              </p>
              <p className="mt-2 text-sm leading-relaxed text-[#6F625C]">
                Message · photo · theme · optional PIN
              </p>
            </div>
            <div className="absolute bottom-8 left-6 right-6 flex items-end justify-between gap-3">
              <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-[#E8D9D2]/80">
                <QrCode className="h-14 w-14 text-[#55382D]" strokeWidth={1.4} />
                <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#6F625C]">
                  Edit QR
                </p>
              </div>
              <div className="rounded-2xl bg-[#55382D] p-3 text-white shadow-sm">
                <QrCode className="h-14 w-14 opacity-95" strokeWidth={1.4} />
                <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/80">
                  View QR
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function WhatIsSection() {
  return (
    <section id="what-is" className={cn(sectionPad, 'scroll-mt-24 bg-white')}>
      <div className={cn('mx-auto', LANDING_MAX_WIDTH)}>
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#DE7C72]">
            What it is
          </p>
          <h2 className={cn(displayHeading, 'mt-3 text-3xl sm:text-4xl')}>
            A personalised digital message with your Hommly gift
          </h2>
          <p className={cn(bodyText, 'mt-5 text-base leading-relaxed sm:text-lg')}>
            Hommly eCard is not a stored-value gift card. It is a digital surprise
            that travels with a physical Hommly gift — your words, photo, and
            finishing touches, opened instantly when the recipient scans.
          </p>
        </div>

        <ul className="mt-12 grid gap-8 sm:grid-cols-3">
          {[
            {
              icon: Gift,
              title: 'Attached to the gift',
              copy: 'Included with selected Hommly gifts as a printed QR card in the parcel.',
            },
            {
              icon: Sparkles,
              title: 'Personal, not transactional',
              copy: 'Made for farewells, thank-yous, celebrations, and thoughtful everyday moments.',
            },
            {
              icon: Heart,
              title: 'No app required',
              copy: 'Create and view in the browser. Recipients simply scan with their phone camera.',
            },
          ].map((item) => (
            <li key={item.title} className="min-w-0">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FCE8E4] text-[#DE7C72]">
                <item.icon className="h-5 w-5" aria-hidden />
              </span>
              <h3 className="mt-4 font-display text-lg font-semibold text-[#55382D]">
                {item.title}
              </h3>
              <p className={cn(bodyText, 'mt-2 text-sm leading-relaxed')}>{item.copy}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function QrDifferenceSection() {
  return (
    <section id="qr-codes" className={cn(sectionPad, 'scroll-mt-24 bg-[#FFF9F5]')}>
      <div className={cn('mx-auto', LANDING_MAX_WIDTH)}>
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#DE7C72]">
            Two QR codes
          </p>
          <h2 className={cn(displayHeading, 'mt-3 text-3xl sm:text-4xl')}>
            Edit QR and View QR do different jobs
          </h2>
          <p className={cn(bodyText, 'mt-4 text-base leading-relaxed')}>
            Keep them separate. One is for creating. One is for the recipient.
          </p>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-2 lg:gap-8">
          <article className="rounded-[1.75rem] bg-white p-7 shadow-[0_18px_40px_-32px_rgba(85,56,45,0.35)] ring-1 ring-[#E8D9D2]/90 sm:p-9">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#55382D] text-white">
                <PencilLine className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#6F625C]">
                  For the sender
                </p>
                <h3 className="font-display text-xl font-semibold text-[#55382D]">Edit QR</h3>
              </div>
            </div>
            <p className={cn(bodyText, 'mt-5 text-sm leading-relaxed sm:text-[15px]')}>
              Scan the Edit QR (and enter the Edit PIN when prompted) to personalise
              the eCard — message, photo, theme, links, and optional Viewing PIN.
            </p>
            <ul className="mt-6 space-y-3 text-sm text-[#55382D]">
              {[
              'Opens the private editor',
              'Protected by your Edit PIN',
              'Manages every eCard in your order',
              ].map((line) => (
                <li key={line} className="flex gap-2.5">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#DE7C72]" />
                  <span className={bodyText}>{line}</span>
                </li>
              ))}
            </ul>
          </article>

          <article className="rounded-[1.75rem] bg-[#DE7C72] p-7 text-white shadow-[0_18px_40px_-28px_rgba(222,124,114,0.55)] sm:p-9">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/15">
                <Eye className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/75">
                  For the recipient
                </p>
                <h3 className="font-display text-xl font-semibold">View QR</h3>
              </div>
            </div>
            <p className="mt-5 text-sm leading-relaxed text-white/90 sm:text-[15px]">
              The recipient scans the View QR to open your finished eCard in their
              browser — no app install, no account.
            </p>
            <ul className="mt-6 space-y-3 text-sm text-white/95">
              {[
              'Unique to each gift in the order',
              'Optional Viewing PIN if you set one',
              'Designed to feel like unwrapping a moment',
              ].map((line) => (
                <li key={line} className="flex gap-2.5">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-white/80" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </article>
        </div>
      </div>
    </section>
  );
}

export function SenderFlowSection() {
  const steps = [
    {
      n: '01',
      title: 'Receive your Hommly gift',
      copy: 'Selected gifts include a printed QR card with Edit and View access.',
      image: ECARD_STEP_IMAGES[0],
      alt: 'The Hommly gift box with its printed QR card',
    },
    {
      n: '02',
      title: 'Scan the Edit QR',
      copy: 'Scan the Edit QR and enter your 6-digit Edit PIN to access the editor.',
      image: ECARD_STEP_IMAGES[1],
      alt: 'Scanning the Edit QR and entering the Edit PIN on a phone',
    },
    {
      n: '03',
      title: 'Personalise & save',
      copy: 'Add your message, photo, links, eCard style and optional Viewing PIN, then save when you are ready.',
      image: ECARD_STEP_IMAGES[2],
      alt: 'The eCard editor with a message, photo and theme selected',
    },
  ] as const;

  return (
    <section id="create" className={cn(sectionPad, 'scroll-mt-24 bg-white')}>
      <div className={cn('mx-auto min-w-0', LANDING_MAX_WIDTH)}>
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#DE7C72]">
            For senders
          </p>
          <h2 className={cn(displayHeading, 'mt-3 text-3xl sm:text-4xl')}>
            When and how you create the eCard
          </h2>
          <p className={cn(bodyText, 'mt-4 text-base leading-relaxed')}>
            Creation happens after the gift is ready — you scan to create, then they
            scan to view.
          </p>
        </div>

        {/*
          Mobile: stacked tutorial — number → title → copy → image per step.
          Desktop: same per-step ownership in a 3-column grid (image stays with its copy).
        */}
        <ol className="mt-12 space-y-0 sm:grid sm:grid-cols-3 sm:gap-8 sm:space-y-0">
          {steps.map((step, index) => (
            <li
              key={step.n}
              className={cn(
                'min-w-0',
                index < steps.length - 1 &&
                  'border-b border-[#E8D9D2]/80 pb-12 mb-12 sm:mb-0 sm:border-b-0 sm:pb-0'
              )}
            >
              <p className="font-display text-4xl font-semibold tabular-nums leading-none text-[#DE7C72]/55">
                {step.n}
              </p>
              <h3 className="mt-3 font-display text-lg font-semibold tracking-[-0.02em] text-[#55382D]">
                {step.title}
              </h3>
              <p className={cn(bodyText, 'mt-2 text-sm leading-relaxed')}>{step.copy}</p>

              <div className="relative mt-5 aspect-[4/3] w-full max-w-full overflow-hidden rounded-2xl bg-[#FCE8E4] ring-1 ring-[#E8D9D2]/80">
                <Image
                  src={step.image}
                  alt={step.alt}
                  fill
                  sizes="(max-width: 640px) 100vw, 33vw"
                  className="object-cover"
                />
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function RecipientSection() {
  return (
    <section id="recipient" className={cn(sectionPad, 'scroll-mt-24 bg-[#FFF9F5]')}>
      <div
        className={cn(
          'mx-auto grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16',
          LANDING_MAX_WIDTH
        )}
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#DE7C72]">
            For recipients
          </p>
          <h2 className={cn(displayHeading, 'mt-3 text-3xl sm:text-4xl')}>
            What they see when they scan
          </h2>
          <p className={cn(bodyText, 'mt-4 text-base leading-relaxed')}>
            The View QR opens a polished digital card in the browser — your message,
            photo, and theme, with any links you chose to share.
          </p>
          <ul className="mt-8 space-y-4">
            {[
              'Camera scan → instant browser open',
              'Optional Viewing PIN before the reveal',
              'A calm, gift-like experience — not a form',
            ].map((line) => (
              <li key={line} className="flex items-start gap-3 text-sm text-[#55382D] sm:text-[15px]">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#FCE8E4] text-[#DE7C72]">
                  <Sparkles className="h-3 w-3" aria-hidden />
                </span>
                <span className={bodyText}>{line}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative mx-auto w-full max-w-[280px] motion-safe:animate-hommly-rise">
          <div className="rounded-[2rem] bg-[#55382D] p-2.5 shadow-[0_28px_50px_-30px_rgba(85,56,45,0.55)]">
            <div className="overflow-hidden rounded-[1.55rem] bg-[#FFF9F5]">
              <div className="bg-[linear-gradient(160deg,#FCE8E4,#DDEAF6)] px-5 pb-8 pt-6">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6F625C]/80">
                  Hommly eCard
                </p>
                <p className="mt-4 font-display text-2xl font-semibold leading-snug text-[#55382D]">
                  Thank you for everything.
                </p>
              </div>
              <div className="space-y-3 px-5 py-5">
                <div className="h-28 rounded-xl bg-[#F7D5C7]/70" />
                <p className="text-sm leading-relaxed text-[#6F625C]">
                  Wishing you the warmest next chapter…
                </p>
                <div className="flex gap-2 pt-1">
                  <span className="h-8 w-8 rounded-full bg-[#FCE8E4]" />
                  <span className="h-8 w-8 rounded-full bg-[#DDEAF6]" />
                  <span className="h-8 w-8 rounded-full bg-[#F7E8A8]" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function ContentSection() {
  const items = [
    { icon: MessageSquareHeart, title: 'Personal message', copy: 'Write words that feel like you.' },
    { icon: ImageIcon, title: 'Photo', copy: 'Add a favourite moment or memory.' },
    { icon: Palette, title: 'Themes & animation', copy: 'Choose a look that matches the occasion.' },
    { icon: Link2, title: 'Optional links', copy: 'WhatsApp, Instagram, website, and more.' },
    { icon: Lock, title: 'Viewing PIN', copy: 'Protect the reveal with a 4–6 digit PIN.' },
    { icon: Sparkles, title: 'More to come', copy: 'New touches are on the way — stay tuned.' },
  ];

  return (
    <section id="content" className={cn(sectionPad, 'scroll-mt-24 bg-white')}>
      <div className={cn('mx-auto', LANDING_MAX_WIDTH)}>
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#DE7C72]">
            Personalisation
          </p>
          <h2 className={cn(displayHeading, 'mt-3 text-3xl sm:text-4xl')}>
            What you can add
          </h2>
        </div>
        <ul className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <li key={item.title}>
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFF1EB] text-[#DE7C72]">
                <item.icon className="h-[18px] w-[18px]" aria-hidden />
              </span>
              <h3 className="mt-3 font-display text-base font-semibold text-[#55382D]">
                {item.title}
              </h3>
              <p className={cn(bodyText, 'mt-1.5 text-sm leading-relaxed')}>{item.copy}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** Illustrative gift row used to show what a selection looks like. */
function GiftSelectionRow({ label, selected }: { label: string; selected: boolean }) {
  return (
    <li
      className={cn(
        'flex min-w-0 items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium',
        selected
          ? 'bg-[#FCE8E4] text-[#55382D] ring-1 ring-[#DE7C72]/30'
          : 'bg-[#FFF9F5] text-[#6F625C]/75 ring-1 ring-[#E8D9D2]/70'
      )}
    >
      <span
        className={cn(
          'flex h-4 w-4 shrink-0 items-center justify-center rounded-full',
          selected ? 'bg-[#DE7C72] text-white' : 'bg-white ring-1 ring-[#E8D9D2]'
        )}
      >
        {selected ? <Check className="h-2.5 w-2.5" strokeWidth={3.5} aria-hidden /> : null}
      </span>
      <span className="min-w-0 leading-snug">{label}</span>
    </li>
  );
}

export function MultipleCardsSection() {
  const gifts = ['Gift #01', 'Gift #02', 'Gift #03', 'Gift #04'];

  const options = [
    {
      eyebrow: 'One gift',
      title: 'Edit one',
      copy: 'Choose one eCard and personalise it just for that recipient.',
      selection: [true, false, false, false],
      greatFor: ['Personal gifts', 'Birthdays', 'Farewells'],
      useCase: 'Give one recipient their own message, photo and personal details.',
      caption: 'One recipient updated',
    },
    {
      eyebrow: 'Several gifts',
      title: 'Select a few',
      copy: 'Choose multiple eCards and apply the same content to them together.',
      selection: [true, true, false, true],
      greatFor: ['Teams', 'Teacher gifts', 'Small groups'],
      useCase:
        'Share the same message or details with selected recipients while keeping the rest personalised.',
      caption: 'Selected recipients share the same content',
    },
    {
      eyebrow: 'All gifts',
      title: 'Update everyone',
      copy: 'Select all eCards when every recipient should receive the same content.',
      selection: [true, true, true, true],
      greatFor: ['Corporate gifting', 'Welcome gifts', 'Events & bulk orders'],
      useCaseLead: 'A smart choice for bulk gifting.',
      useCase:
        'Add your company message, website and social links once, then apply them to every eCard in the order.',
      caption: 'Everyone in the order updated at once',
    },
  ];

  return (
    <section id="multiple" className={cn(sectionPad, 'scroll-mt-24 bg-[#FFF9F5]')}>
      <div className={cn('mx-auto min-w-0', LANDING_MAX_WIDTH)}>
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#DE7C72]">
            One Edit QR, flexible personalisation
          </p>
          <h2 className={cn(displayHeading, 'mt-3 text-balance text-3xl sm:text-4xl')}>
            Personalise one, a few, or everyone
          </h2>
          <p className={cn(bodyText, 'mt-5 text-pretty text-base leading-relaxed')}>
            One Edit QR gives you access to every eCard in the order. Personalise each
            one individually, select a few to update together, or apply the same content
            to everyone.
          </p>
        </div>

        {/* Overview — visually distinct from the example cards below */}
        <div className="mt-8 min-w-0 rounded-[1.85rem] bg-gradient-to-b from-white to-[#FFF9F5] px-5 py-6 shadow-[0_18px_40px_-32px_rgba(85,56,45,0.28)] ring-1 ring-[#E8D9D2]/95 sm:mt-12 sm:rounded-[1.75rem] sm:bg-white sm:bg-none sm:p-8 sm:shadow-none">
          {/* Mobile: vertical flow. Desktop: existing horizontal overview. */}
          <div className="flex min-w-0 flex-col items-stretch gap-5 sm:grid sm:grid-cols-[auto_auto_minmax(0,1fr)] sm:items-center sm:gap-7">
            <div className="flex min-w-0 items-center gap-3.5 sm:flex-col sm:gap-2.5 sm:text-center">
              <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#55382D] text-white">
                <QrCode className="h-7 w-7" strokeWidth={1.4} aria-hidden />
              </span>
              <div className="min-w-0 flex-1 sm:flex-none sm:text-center">
                <p className="font-display text-lg font-semibold tracking-[-0.02em] text-[#55382D] sm:text-sm">
                  One Edit QR
                </p>
                <p className={cn(bodyText, 'mt-1 text-sm leading-relaxed sm:hidden')}>
                  One Edit QR gives you access to every eCard in the order.
                </p>
              </div>
            </div>

            <div
              aria-hidden
              className="flex items-center justify-center text-[#DE7C72]/70 sm:justify-start"
            >
              <ArrowDown className="h-5 w-5 sm:hidden" />
              <ArrowRight className="hidden h-5 w-5 sm:block" />
            </div>

            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6F625C]/80 sm:tracking-[0.16em]">
                Choose who to personalise
              </p>
              {/* Mobile: wrap chips cleanly. Desktop: wrap as before. */}
              <ul
                className="mt-3 flex max-w-full flex-wrap gap-2"
                aria-label="Example gifts in the order"
              >
                {gifts.map((gift) => (
                  <li
                    key={gift}
                    className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-medium text-[#55382D] ring-1 ring-[#E8D9D2]/80 sm:bg-[#FFF9F5]"
                  >
                    <Gift className="h-3.5 w-3.5 shrink-0 text-[#DE7C72]" aria-hidden />
                    {gift}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs font-medium leading-relaxed text-[#6F625C]/70">
                and the rest of the order
              </p>
            </div>
          </div>

          <div className="mt-6 flex min-w-0 items-start gap-2.5 border-t border-[#E8D9D2]/70 pt-5">
            <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#FCE8E4] text-[#DE7C72]">
              <Eye className="h-3 w-3" aria-hidden />
            </span>
            <p className={cn(bodyText, 'min-w-0 flex-1 text-sm leading-relaxed')}>
              Each gift still has its own unique View QR, so every recipient opens only
              their own eCard.
            </p>
          </div>
        </div>

        {/* Examples divider — clarifies hierarchy after overview */}
        <div className="mx-auto mt-10 max-w-2xl text-center sm:mt-10">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#DE7C72]">
            Ways to personalise
          </p>
          <p className={cn(bodyText, 'mt-2 text-sm leading-relaxed sm:mt-2.5')}>
            Use the same Edit QR to personalise one, several, or all gifts.
          </p>
        </div>

        <ul className="mt-5 grid min-w-0 gap-4 sm:mt-6 sm:gap-5 md:grid-cols-2 lg:grid-cols-3 lg:items-stretch">
          {options.map((option) => (
            <li
              key={option.title}
              className="flex h-full min-w-0 flex-col rounded-[1.5rem] bg-white p-5 ring-1 ring-[#E8D9D2]/90 sm:p-6"
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#DE7C72]/90">
                {option.eyebrow}
              </p>
              <h3 className="mt-2 font-display text-lg font-semibold text-[#55382D]">
                {option.title}
              </h3>
              <p className={cn(bodyText, 'mt-2 text-sm leading-relaxed')}>{option.copy}</p>

              <ul className="mt-5 min-w-0 space-y-1.5" aria-hidden>
                {gifts.map((gift, index) => (
                  <GiftSelectionRow
                    key={gift}
                    label={gift}
                    selected={option.selection[index]}
                  />
                ))}
              </ul>

              <div className="mt-5 min-w-0 rounded-[13px] bg-[#FFF9F5] px-3.5 py-3.5 ring-1 ring-[#E8D9D2]/70">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#6F625C]/75">
                  Great for
                </p>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {option.greatFor.map((label) => (
                    <li
                      key={label}
                      className="rounded-md bg-white px-2 py-1 text-[12px] font-medium leading-snug text-[#55382D] ring-1 ring-[#E8D9D2]/80"
                    >
                      {label}
                    </li>
                  ))}
                </ul>
                {'useCaseLead' in option && option.useCaseLead ? (
                  <p className="mt-2 text-[13px] font-semibold leading-snug text-[#55382D]">
                    {option.useCaseLead}
                  </p>
                ) : null}
                <p
                  className={cn(
                    bodyText,
                    'text-[13px] leading-relaxed',
                    'useCaseLead' in option && option.useCaseLead ? 'mt-1' : 'mt-2'
                  )}
                >
                  {option.useCase}
                </p>
              </div>

              <p className="mt-auto pt-4 text-[11px] font-medium uppercase leading-relaxed tracking-[0.12em] text-[#6F625C]/70 sm:tracking-[0.14em]">
                {option.caption}
              </p>
            </li>
          ))}
        </ul>

        <div className="mx-auto mt-6 flex max-w-2xl min-w-0 items-start gap-2.5 rounded-2xl bg-[#FCE8E4]/60 px-4 py-4 sm:px-5">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#DE7C72]" aria-hidden />
          <p className="min-w-0 text-sm leading-relaxed text-[#55382D]">
            Mix and match anytime — some eCards can share the same content while others
            stay completely personal.
          </p>
        </div>
      </div>
    </section>
  );
}

export function ConditionsSection() {
  return (
    <section id="conditions" className={cn(sectionPad, 'scroll-mt-24 bg-white')}>
      <div className={cn('mx-auto', LANDING_MAX_WIDTH)}>
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#DE7C72]">
            Good to know
          </p>
          <h2 className={cn(displayHeading, 'mt-3 text-3xl sm:text-4xl')}>
            Important conditions
          </h2>
        </div>
        <dl className="mt-10 grid gap-8 sm:grid-cols-2">
          <div>
            <dt className="font-display text-lg font-semibold text-[#55382D]">
              {ECARD_AVAILABILITY_MONTHS}-month availability
            </dt>
            <dd className={cn(bodyText, 'mt-2 text-sm leading-relaxed')}>
              Your Hommly eCard stays available for {ECARD_AVAILABILITY_MONTHS} months
              from the order date.
            </dd>
          </div>
          <div>
            <dt className="font-display text-lg font-semibold text-[#55382D]">
              Not a cash / stored-value card
            </dt>
            <dd className={cn(bodyText, 'mt-2 text-sm leading-relaxed')}>
              Hommly eCard carries a personal digital message. It does not hold
              monetary balance or replace payment vouchers.
            </dd>
          </div>
          <div>
            <dt className="font-display text-lg font-semibold text-[#55382D]">
              Edit PIN stays private
            </dt>
            <dd className={cn(bodyText, 'mt-2 text-sm leading-relaxed')}>
              Use the Edit PIN only for creating or updating. Recipients should receive
              the View QR — not the Edit QR or Edit PIN.
            </dd>
          </div>
          <div>
            <dt className="font-display text-lg font-semibold text-[#55382D]">
              Need help?
            </dt>
            <dd className={cn(bodyText, 'mt-2 text-sm leading-relaxed')}>
              Email{' '}
              <a
                href={HOMMLY_ECARD_MAILTO}
                className="font-semibold text-[#DE7C72] underline decoration-[#F7D5C7] underline-offset-2 hover:text-[#d46d63]"
              >
                {HOMMLY_ECARD_EMAIL}
              </a>{' '}
              and we&apos;ll help you sort it out.
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}

export function UseCasesSection() {
  const cases = [
    {
      icon: Heart,
      title: 'Farewells & thank-yous',
      copy: 'Leave a lasting note when words at the door aren’t enough.',
      wash: 'bg-[#FCE8E4]',
    },
    {
      icon: School,
      title: 'Schools & teachers',
      copy: 'Class gifts with a personal message each student will remember.',
      wash: 'bg-[#DDEAF6]',
    },
    {
      icon: Users,
      title: 'Customer & corporate gifts',
      copy: 'Warm, on-brand appreciation that feels human — not templated.',
      wash: 'bg-[#F7E8A8]/70',
    },
    {
      icon: Gift,
      title: 'Events & celebrations',
      copy: 'Weddings, birthdays, baby showers — a digital keepsake with the parcel.',
      wash: 'bg-[#F7D5C7]/60',
    },
  ];

  return (
    <section id="occasions" className={cn(sectionPad, 'scroll-mt-24 bg-[#FFF9F5]')}>
      <div className={cn('mx-auto', LANDING_MAX_WIDTH)}>
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#DE7C72]">
            Occasions
          </p>
          <h2 className={cn(displayHeading, 'mt-3 text-3xl sm:text-4xl')}>
            Made for moments that matter
          </h2>
        </div>
        <ul className="mt-12 grid gap-5 sm:grid-cols-2">
          {cases.map((item) => (
            <li
              key={item.title}
              className={cn(
                'rounded-[1.5rem] px-6 py-7 ring-1 ring-[#E8D9D2]/50',
                item.wash
              )}
            >
              <item.icon className="h-5 w-5 text-[#55382D]/80" aria-hidden />
              <h3 className="mt-4 font-display text-lg font-semibold text-[#55382D]">
                {item.title}
              </h3>
              <p className={cn(bodyText, 'mt-2 text-sm leading-relaxed')}>{item.copy}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function EcardFinalCta() {
  return (
    <section className={cn(sectionPad, 'bg-white')}>
      <div className={cn('mx-auto', LANDING_MAX_WIDTH)}>
        <div className="relative overflow-hidden rounded-[2rem] bg-[#55382D] px-6 py-12 sm:px-10 sm:py-14 lg:px-14">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-8 top-0 h-48 w-48 rounded-full bg-[#DE7C72]/35 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-16 left-10 h-40 w-40 rounded-full bg-[#F7E8A8]/25 blur-3xl"
          />
          <div className="relative max-w-xl">
            <h2 className="font-display text-3xl font-semibold leading-snug tracking-[-0.02em] text-white sm:text-4xl">
              Ready to attach a moment to your gift?
            </h2>
            <p className="mt-4 text-base text-white/80">
              Shop selected Hommly gifts, then scan to create — they scan to view.
            </p>
            <div className="mt-8 flex flex-col gap-3.5 sm:flex-row sm:gap-3.5">
              <HommlyCta href={SHOP_URL} variant="primary" external block className="sm:w-auto">
                Shop on Hommly.sg
              </HommlyCta>
              <HommlyCta href="/" variant="onDark" block className="sm:w-auto">
                Back to Hommly eCard home
              </HommlyCta>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
