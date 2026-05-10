import { FinalCtaSection } from "@/components/landing/final-cta-section";
import { HeroSection } from "@/components/landing/hero-section";
import { HowItWorksSection } from "@/components/landing/how-it-works-section";
import { IntroSection } from "@/components/landing/intro-section";
import { LandingNavbar } from "@/components/landing/navbar";

export function LandingPage() {
  return (
    <div
      id="landing-scroll-root"
      className="landing-scroll-root relative h-screen overflow-y-auto bg-[#fbfbff] text-[#24213d]"
    >
      <LandingNavbar />
      <div className="relative">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-0 h-full min-h-[400vh]"
          aria-hidden="true"
          style={{
            background:
              "radial-gradient(circle 46rem at 13% 8%, rgba(137, 126, 242, 0.18), transparent 64%), radial-gradient(circle 54rem at 76% 7%, rgba(255, 187, 152, 0.27), transparent 62%), radial-gradient(circle 58rem at 90% 30%, rgba(183, 244, 226, 0.42), transparent 64%), radial-gradient(circle 45rem at 9% 60%, rgba(129, 124, 242, 0.10), transparent 66%), radial-gradient(circle 48rem at 88% 88%, rgba(255, 187, 152, 0.2), transparent 62%), linear-gradient(180deg, #fbfbff 0%, #ffffff 32%, #fbfbff 68%, #f8f7ff 100%)",
          }}
        />
        <main className="relative z-10">
          <HeroSection />
          <IntroSection />
          <HowItWorksSection />
          <FinalCtaSection />
        </main>
      </div>
    </div>
  );
}
