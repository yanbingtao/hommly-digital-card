import { LandingHeader } from '@/components/home/LandingHeader';
import { HeroSection } from '@/components/home/HeroSection';
import { VisualDemo } from '@/components/home/VisualDemo';
import { HowItWorks } from '@/components/home/HowItWorks';
import { UseCases } from '@/components/home/UseCases';
import { FinalCta, LandingFooter } from '@/components/home/FinalCta';

export default function Home() {
  return (
    <div className="min-h-screen bg-[#fdf8f3]">
      <LandingHeader />
      <main>
        <HeroSection />
        <VisualDemo />
        <HowItWorks />
        <UseCases />
        <FinalCta />
      </main>
      <LandingFooter />
    </div>
  );
}
