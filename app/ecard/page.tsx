import type { Metadata } from 'next';
import { LandingHeader } from '@/components/home/LandingHeader';
import { LandingFooter } from '@/components/home/FinalCta';
import {
  ConditionsSection,
  ContentSection,
  EcardFinalCta,
  EcardHero,
  MultipleCardsSection,
  QrDifferenceSection,
  RecipientSection,
  SenderFlowSection,
  UseCasesSection,
  WhatIsSection,
} from '@/components/ecard/EcardGuideSections';
import { ECARD_AVAILABILITY_MONTHS } from '@/components/home/constants';

export const metadata: Metadata = {
  title: 'Hommly eCard — You scan to create. They scan to view.',
  description:
    'Learn how Hommly eCard works: Edit QR vs View QR, what senders create, what recipients see, personalisation options, and the 6-month availability window.',
  openGraph: {
    title: 'Hommly eCard — You scan to create. They scan to view.',
    description:
      'A personalised digital message attached to a physical Hommly gift. Not a stored-value card — a moment they will remember.',
  },
};

const ECARD_NAV = [
  { href: '#what-is', label: 'What it is', visibility: 'sm' as const },
  { href: '#qr-codes', label: 'Edit vs View', visibility: 'md' as const },
  { href: '#occasions', label: 'Occasions', visibility: 'md' as const },
];

export default function EcardGuidePage() {
  return (
    <div className="hommly-landing hommly-ecard-guide min-h-screen bg-[#FFF9F5] text-[#55382D]">
      <LandingHeader navLinks={ECARD_NAV} />
      <main>
        <EcardHero />
        <WhatIsSection />
        <QrDifferenceSection />
        <SenderFlowSection />
        <RecipientSection />
        <ContentSection />
        <MultipleCardsSection />
        <ConditionsSection />
        <UseCasesSection />
        <EcardFinalCta />
      </main>
      <LandingFooter />
      <span className="sr-only">
        Hommly eCard remains available for {ECARD_AVAILABILITY_MONTHS} months from order date.
      </span>
    </div>
  );
}
