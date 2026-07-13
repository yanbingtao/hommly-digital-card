import { LandingHeader } from '@/components/home/LandingHeader';
import { HeroSection } from '@/components/home/HeroSection';
import { WhyLoveSection } from '@/components/home/WhyLoveSection';
import { HowItWorks } from '@/components/home/HowItWorks';
import { PreviewExperience } from '@/components/home/PreviewExperience';
import { UseCases } from '@/components/home/UseCases';
import { FaqSection } from '@/components/home/FaqSection';
import { FinalCta, LandingFooter } from '@/components/home/FinalCta';

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      <LandingHeader />
      <main>
        <HeroSection />
        <WhyLoveSection />
        <HowItWorks />
        <PreviewExperience />
        <UseCases />
        <FaqSection />
        <FinalCta />
      </main>
      <LandingFooter />
    </div>
  );
}
