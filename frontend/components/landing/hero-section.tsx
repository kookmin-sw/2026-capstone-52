"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";
import { useEffect, useRef, useState } from "react";

const featureCards = [
  {
    title: "간단한 질문",
    description: "현재 수준 진단",
  },
  {
    title: "맞춤 설명",
    description: "개념별 난이도 조절",
  },
  {
    title: "지식 그래프",
    description: "학습 흐름 시각화",
  },
] as const;

const heroItemVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 34,
    filter: "blur(10px)",
  },
  visible: (index = 0) => ({
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: {
      type: "spring",
      stiffness: 120,
      damping: 18,
      mass: 0.9,
      delay: 0.08 + index * 0.1,
    },
  }),
};

function TutorAppMockup({ isAnimating }: { isAnimating: boolean }) {
  return (
    <div className="landing-tutor-mockup-shell relative mx-auto w-full max-w-[830px] lg:mx-0 lg:justify-self-end">
      <div
        className={`landing-tutor-mockup-viewport ${
          isAnimating ? "landing-tutor-mockup-viewport-active" : ""
        }`}
      >
        <div className="landing-tutor-mockup-panel overflow-hidden rounded-[1.85rem] border border-[#e4e2f0] bg-white shadow-[0_34px_90px_rgba(71,76,129,0.14)]">
          <div className="flex h-16 items-center justify-between border-b border-[#eceaf5] px-6">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-[#ff855f]" />
              <span className="h-3 w-3 rounded-full bg-[#60cfa2]" />
              <span className="h-3 w-3 rounded-full bg-[#7f82f0]" />
            </div>
            <span className="rounded-full bg-[#f0edff] px-4 py-2 text-[0.74rem] font-bold text-[#817cf2]">
              운영체제 - 프로세스 스케줄링
            </span>
          </div>

          <div className="grid min-h-[398px] grid-cols-[220px_minmax(0,1fr)_190px] bg-white max-md:grid-cols-1">
            <aside className="bg-[#f4f2fb] px-6 py-6 max-md:hidden">
              {["운영체제", "자료구조", "알고리즘", "컴퓨터 네트워크"].map((item, index) => (
                <div
                  key={item}
                  className={`mb-4 rounded-xl px-5 py-4 text-[0.92rem] font-bold ${
                    index === 0 ? "bg-white text-[#7c75ed]" : "text-[#6c6688]"
                  }`}
                >
                  {item}
                </div>
              ))}
            </aside>

            <div className="space-y-5 border-x border-[#eceaf5] bg-white px-7 py-7 max-md:border-x-0">
              <div className="landing-tutor-chat-bubble landing-tutor-chat-bubble-1 rounded-[1.1rem] bg-[#f0eefb] px-6 py-5 text-[1.04rem] leading-7 text-[#26233f]">
                <p>
                  FCFS와 Round Robin은 이해하고 계시지만,{" "}
                  <strong className="font-bold text-[#e46c3f]">기아 현상</strong>{" "}
                  개념이 부족해요.
                </p>
              </div>
              <div className="flex justify-end">
                <div className="landing-tutor-chat-bubble landing-tutor-chat-bubble-2 max-w-[78%] rounded-[1rem] bg-[#817cf2] px-7 py-4 text-right text-[0.96rem] font-bold leading-6 text-white">
                  그러면 해결 방법은 뭔가요?
                </div>
              </div>
              <div className="landing-tutor-chat-bubble landing-tutor-chat-bubble-3 rounded-[1rem] bg-[#f0eefb] px-6 py-5 text-[0.96rem] font-semibold leading-7 text-[#565177]">
                오래 기다린 프로세스의 우선순위를 높이는{" "}
                <strong className="text-[#26233f]">에이징</strong>부터 이해하면 좋아요.
              </div>
            </div>

            <aside className="bg-white px-4 py-6 max-md:hidden">
              <p className="mb-4 text-[0.78rem] font-extrabold text-[#28243f]">최근 업데이트</p>
              {["프로세스 스케줄링", "기아 현상", "에이징"].map((item, index) => (
                <div
                  key={item}
                  className={`mb-3 rounded-lg px-4 py-3 text-[0.78rem] font-bold ${
                    index === 1
                      ? "bg-[#ffddcc] text-[#d86a3f]"
                      : "bg-[#f1effb] text-[#28243f]"
                  }`}
                >
                  {item}
                </div>
              ))}
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}

export function HeroSection() {
  const heroRef = useRef<HTMLElement | null>(null);
  const hasPlayedIntroRef = useRef(false);
  const shouldReduceMotion = useReducedMotion();
  const [heroAnimationState, setHeroAnimationState] = useState<"hidden" | "visible">("hidden");
  const [isMockupAnimating, setIsMockupAnimating] = useState(false);

  useEffect(() => {
    if (hasPlayedIntroRef.current) {
      return;
    }

    hasPlayedIntroRef.current = true;

    if (shouldReduceMotion) {
      setHeroAnimationState("visible");
      setIsMockupAnimating(true);
      return;
    }

    setHeroAnimationState("visible");
  }, [shouldReduceMotion]);

  return (
    <section
      id="hero"
      ref={heroRef}
      className="relative z-20 min-h-screen scroll-mt-24 overflow-hidden text-[#24213d]"
    >
      <div className="relative mx-auto flex min-h-screen max-w-[1800px] flex-col justify-center px-6 pb-20 pt-32 md:px-12 xl:px-[4.7rem]">
        <motion.div
          className="grid items-center gap-14 xl:grid-cols-[0.94fr_1.06fr] 2xl:gap-[4.5rem]"
          initial="hidden"
          animate={heroAnimationState}
        >
          <div className="max-w-[774px]">
            <motion.span
              className="inline-flex items-center rounded-full bg-[#f0edff] px-[1.125rem] py-2 text-[0.92rem] font-bold text-[#817cf2]"
              variants={heroItemVariants}
              custom={0}
            >
              ✦ AI 맞춤 학습 튜터
            </motion.span>

            <motion.h1
              className="mt-7 text-[3.05rem] font-black leading-[1.08] tracking-normal text-[#24213d] md:text-[3.95rem] 2xl:text-[4.85rem]"
              variants={heroItemVariants}
              custom={1}
            >
              <span className="whitespace-nowrap">나의 이해를 읽고,</span>
              <br />
              <span className="bg-gradient-to-r from-[#817cf2] via-[#b989c8] to-[#ef8f79] bg-clip-text text-transparent">
                배움의 흐름을 잇다
              </span>
            </motion.h1>

            <motion.p
              className="mt-7 max-w-[700px] text-[1.1rem] font-medium leading-9 text-[#74708b]"
              variants={heroItemVariants}
              custom={2}
            >
              AI가 내 이해도를 파악하고, 프로젝트별 지식 그래프를 쌓아가며 지금 나에게
              <br className="hidden md:block" />
              필요한 설명을 이어주는 AI 튜터 서비스입니다.
            </motion.p>

            <motion.div
              className="mt-10 flex flex-wrap items-center gap-3"
              variants={heroItemVariants}
              custom={3}
            >
              <a
                href="/dashboard"
                className="inline-flex min-h-14 items-center justify-center rounded-full bg-[#817cf2] px-10 text-[1.06rem] font-bold text-white shadow-[0_14px_30px_rgba(129,124,242,0.32)] transition hover:bg-[#716be8]"
              >
                시작하기 <span className="ml-3 text-[1.3rem] leading-none">→</span>
              </a>
              <a
                href="#intro"
                className="inline-flex min-h-14 items-center justify-center rounded-full border border-[#e5e3ef] bg-white px-10 text-[1.06rem] font-bold text-[#24213d] shadow-[0_10px_28px_rgba(42,38,73,0.06)] transition hover:border-[#cac5ef] hover:text-[#817cf2]"
              >
                <span className="translate-y-[1px]">이음 더 알아보기</span>
              </a>
            </motion.div>

            <div className="mt-12 grid max-w-[684px] gap-4 sm:grid-cols-3">
              {featureCards.map((card, index) => (
                <motion.div
                  key={card.title}
                  className="rounded-xl border border-[#e6e4f0] bg-white/82 px-5 py-4 shadow-[0_14px_30px_rgba(42,38,73,0.06)] backdrop-blur"
                  variants={heroItemVariants}
                  custom={4 + index}
                >
                  <p className="text-[1.06rem] font-black text-[#817cf2]">{card.title}</p>
                  <p className="mt-1.5 text-[0.8rem] font-semibold text-[#77728d]">{card.description}</p>
                </motion.div>
              ))}
            </div>
          </div>

          <motion.div
            variants={heroItemVariants}
            custom={7}
            onAnimationComplete={(definition) => {
              if (definition === "visible") {
                setIsMockupAnimating(true);
              }
            }}
          >
            <TutorAppMockup isAnimating={isMockupAnimating} />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
