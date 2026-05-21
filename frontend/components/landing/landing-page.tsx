"use client";

import { FinalCtaSection } from "@/components/landing/final-cta-section";
import { HeroSection } from "@/components/landing/hero-section";
import { HowItWorksSection } from "@/components/landing/how-it-works-section";
import { LandingBackgroundLayer } from "@/components/landing/landing-background-layer";
import { IntroSection } from "@/components/landing/intro-section";
import { LandingNavbar } from "@/components/landing/navbar";
import { useRef } from "react";

export function LandingPage() {
  const scrollRootRef = useRef<HTMLDivElement | null>(null);

  return (
    <div
      id="landing-scroll-root"
      ref={scrollRootRef}
      className="landing-scroll-root relative h-screen overflow-y-auto bg-[#fbfbff] text-[#24213d]"
    >
      <LandingNavbar scrollRootRef={scrollRootRef} />
      <div className="relative">
        <LandingBackgroundLayer />
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
