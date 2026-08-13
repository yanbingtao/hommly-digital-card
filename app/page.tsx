import type { Metadata } from 'next';
import { LandingHeader } from '@/components/home/LandingHeader';
import { HeroSection } from '@/components/home/HeroSection';
import { BenefitStrip } from '@/components/home/BenefitStrip';
import { HowItWorks } from '@/components/home/HowItWorks';
import { RecipientExperienceSection } from '@/components/home/RecipientExperienceSection';
import { HommlyGiftSection } from '@/components/home/HommlyGiftSection';
import { OccasionsSection } from '@/components/home/OccasionsSection';
import { FaqSection } from '@/components/home/FaqSection';
import { FinalCta, LandingFooter } from '@/components/home/FinalCta';
import { getHomeAssetAvailability } from '@/lib/home-assets';

export const metadata: Metadata = {
  title: "Hommly eCard — More than a gift. A moment they'll remember.",
  description:
    'Add personalised messages, photos and digital surprises to selected Hommly gifts. Recipients simply scan the included QR card — no app required.',
  openGraph: {
    title: 'Hommly eCard — More than a gift',
    description:
      'Personalise selected Hommly gifts with a message, photo and digital eCard. Recipients scan the QR card — no app required.',
  },
};

export default function Home() {
  const assets = getHomeAssetAvailability();

  return (
    <div className="hommly-landing min-h-screen bg-[#fffaf7] text-stone-900">
      <LandingHeader />
      <main>
        <HeroSection assets={assets} />
        <BenefitStrip />
        <HowItWorks />
        <RecipientExperienceSection assets={assets} />
        <HommlyGiftSection assets={assets} />
        <OccasionsSection assets={assets} />
        <FinalCta assets={assets} />
        <FaqSection />
      </main>
      <LandingFooter />
    </div>
  );
}
