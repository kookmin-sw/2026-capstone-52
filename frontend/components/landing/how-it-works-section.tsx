"use client";

import { useEffect, useRef, useState } from "react";

const HIGHLIGHT_INTERVAL_MS = 2000;
const REVEAL_STAGGER_MS = 150;
const REVEAL_INITIAL_DELAY_MS = 40;
const REVEAL_ENTER_RATIO = 0.35;
const REVEAL_EXIT_RATIO = 0.05;

const steps = [
  {
    number: "01",
    title: "자료 업로드",
    description: (
      <>
        PDF 강의자료나 정리본을 업로드하면<br />
        AI가 학습 주제를 파악합니다.
      </>
    ),
    iconSrc: "/icons/landing/upload.svg",
  },
  {
    number: "02",
    title: "학습 수준 진단",
    description: (
      <>
        몇 가지 질문으로 현재 이해도와<br />
        부족한 개념을 확인합니다.
      </>
    ),
    iconSrc: "/icons/landing/target.svg",
  },
  {
    number: "03",
    title: "맞춤 설명",
    description: (
      <>
        진단 결과를 바탕으로 내 수준에 맞춘<br />
        답변을 제공합니다.
      </>
    ),
    iconSrc: "/icons/landing/talk.svg",
  },
  {
    number: "04",
    title: "지식 그래프",
    description: (
      <>
        학습한 개념과 관계를 그래프로 확인하고<br />
        다음 흐름을 잡습니다.
      </>
    ),
    iconSrc: "/icons/landing/triangle.svg",
  },
] as const;

const REVEAL_COMPLETE_DELAY_MS = REVEAL_INITIAL_DELAY_MS + (steps.length - 1) * REVEAL_STAGGER_MS + 700;

function createHiddenSteps() {
  return steps.map(() => false);
}

export function HowItWorksSection() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isHighlightEnabled, setIsHighlightEnabled] = useState(false);
  const [visibleSteps, setVisibleSteps] = useState<boolean[]>(() => createHiddenSteps());

  useEffect(() => {
    const sectionElement = sectionRef.current;

    if (!sectionElement) {
      return undefined;
    }

    if (typeof IntersectionObserver === "undefined") {
      setVisibleSteps(steps.map(() => true));
      setIsHighlightEnabled(true);
      return undefined;
    }

    let isInView = false;
    let revealRunId = 0;
    const timers = new Set<number>();
    let highlightInterval = 0;

    const clearTimers = () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      timers.clear();
    };

    const stopHighlightSequence = () => {
      if (highlightInterval) {
        window.clearInterval(highlightInterval);
        highlightInterval = 0;
      }

      setIsHighlightEnabled(false);
    };

    const stopRevealSequence = () => {
      revealRunId += 1;
      clearTimers();
      stopHighlightSequence();
    };

    const addTimer = (callback: () => void, delay: number, runId: number) => {
      const timer = window.setTimeout(() => {
        timers.delete(timer);
        if (runId !== revealRunId) {
          return;
        }

        callback();
      }, delay);

      timers.add(timer);
    };

    const revealCards = (runId: number) => {
      steps.forEach((_, index) => {
        addTimer(() => {
          if (!isInView || runId !== revealRunId) {
            return;
          }

          setVisibleSteps((current) => current.map((isVisible, stepIndex) => stepIndex === index || isVisible));
        }, index * REVEAL_STAGGER_MS, runId);
      });
    };

    const playRevealSequence = () => {
      stopRevealSequence();
      const runId = revealRunId;

      setIsHighlightEnabled(false);
      setActiveIndex(0);
      setVisibleSteps(createHiddenSteps());

      addTimer(() => {
        if (isInView && runId === revealRunId) {
          revealCards(runId);
        }
      }, REVEAL_INITIAL_DELAY_MS, runId);

      addTimer(() => {
        if (!isInView || runId !== revealRunId) {
          return;
        }

        stopHighlightSequence();
        setActiveIndex(0);
        setIsHighlightEnabled(true);
        highlightInterval = window.setInterval(() => {
          setActiveIndex((current) => (current + 1) % steps.length);
        }, HIGHLIGHT_INTERVAL_MS);
      }, REVEAL_COMPLETE_DELAY_MS, runId);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        const shouldEnterSection = entry.isIntersecting && entry.intersectionRatio >= REVEAL_ENTER_RATIO;
        const shouldExitSection = !entry.isIntersecting || entry.intersectionRatio <= REVEAL_EXIT_RATIO;

        if (shouldEnterSection) {
          if (isInView) {
            return;
          }

          isInView = true;
          playRevealSequence();
          return;
        }

        if (!isInView || !shouldExitSection) {
          return;
        }

        isInView = false;
        stopRevealSequence();
        setVisibleSteps(createHiddenSteps());
      },
      {
        threshold: [0, REVEAL_EXIT_RATIO, REVEAL_ENTER_RATIO],
      }
    );

    observer.observe(sectionElement);

    return () => {
      isInView = false;
      stopRevealSequence();
      observer.disconnect();
    };
  }, []);

  return (
    <section
      id="how-it-works"
      ref={sectionRef}
      className="relative z-20 scroll-mt-24 overflow-hidden text-[#24213d]"
    >
      <span id="features" className="absolute top-0" aria-hidden="true" />
      <div className="absolute inset-0 bg-white" aria-hidden="true" />
      <div className="relative mx-auto flex max-w-[1800px] flex-col px-6 py-10 md:px-12 md:py-11 xl:px-[4.7rem]">
        <div className="mx-auto text-center">
          <span className="inline-flex rounded-full bg-[#f0edff] px-[1.125rem] py-2 text-[0.84rem] font-bold text-[#817cf2]">
            이용 방법
          </span>
          <h2 className="mt-7 text-[2.55rem] font-black leading-[1.18] tracking-normal md:text-[3.15rem] 2xl:text-[3.75rem]">
            이음, 이렇게 사용해요
          </h2>
          <p className="mt-5 text-[1rem] font-medium text-[#74708b] 2xl:text-[1.1rem]">
            자료 업로드부터 맞춤 설명까지 4단계로 완성됩니다.
          </p>
        </div>

        <div className="mt-9 grid gap-5 md:grid-cols-2 xl:grid-cols-4 2xl:gap-7">
          {steps.map((step, index) => {
            const isActive = isHighlightEnabled && index === activeIndex;
            const isVisible = visibleSteps[index];

            return (
              <article
                key={step.number}
                className={[
                  "landing-step-card relative min-h-[234px] rounded-[1.5rem] border border-[#e8e5f2] bg-white px-7 py-8 text-left shadow-[0_24px_64px_rgba(42,38,73,0.06)] transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.18,0.92,0.22,1)] will-change-[opacity,transform] motion-reduce:translate-y-0 motion-reduce:scale-100 motion-reduce:opacity-100 motion-reduce:transition-none 2xl:min-h-[270px] 2xl:px-9 2xl:py-10",
                  isVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0",
                  isActive ? "scale-[1.03]" : "scale-[0.8]",
                ].join(" ")}
              >
                <span className="absolute right-6 top-6 text-[2.7rem] font-black leading-none text-[#e8e5ff] 2xl:text-[3.25rem]">
                  {step.number}
                </span>
                <div className="flex h-14 w-14 items-center justify-center rounded-[1.05rem] bg-[#f0edff] text-[#817cf2] 2xl:h-[4.25rem] 2xl:w-[4.25rem]">
                  <img src={step.iconSrc} alt="" aria-hidden="true" className="h-6 w-6 2xl:h-7 2xl:w-7" />
                </div>
                <h3 className="mt-7 text-[1.2rem] font-black tracking-normal text-[#24213d] 2xl:text-[1.4rem]">
                  {step.title}
                </h3>
                <p className="mt-4 max-w-[17rem] text-[0.9rem] font-medium leading-7 text-[#74708b] 2xl:text-[1rem] 2xl:leading-8">
                  {step.description}
                </p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
