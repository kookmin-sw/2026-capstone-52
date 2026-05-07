import { CoreFeaturesSection } from "@/components/landing/core-features-section";
import { HeroSection } from "@/components/landing/hero-section";
import { HowItWorksSection } from "@/components/landing/how-it-works-section";
import { IntroSection } from "@/components/landing/intro-section";
import { LandingGraphLayer } from "@/components/landing/landing-graph-layer";
import { LandingNavbar } from "@/components/landing/navbar";

export function LandingPage() {
  return (
    <div id="landing-scroll-root" className="h-screen overflow-y-auto bg-[#2A2B2E] text-white">
      <LandingNavbar />
      <div className="relative">
        <div className="pointer-events-none sticky top-[78px] z-0 h-[calc(100vh-78px)] overflow-hidden">
          {/* The graph lives below the sections, and stays pinned while the upper sections scroll over it. */}
          <LandingGraphLayer />
        </div>
        <main className="relative z-10 -mt-[calc(100vh-78px)]">
          <HeroSection />
          <IntroSection />
          <CoreFeaturesSection />
          <HowItWorksSection />
        </main>
      </div>
    </div>
  );
}
