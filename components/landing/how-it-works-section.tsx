"use client";

import { faBullseye, faDiagramProject } from "@fortawesome/free-solid-svg-icons";
import { faFolderOpen, faLightbulb } from "@fortawesome/free-regular-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useEffect, useState } from "react";

const INTERVAL_MS = 2000;

const cards = [
  {
    title: "자료 업로드",
    description: "업로드한 자료를 AI가 자동 분석",
    icon: faFolderOpen,
  },
  {
    title: "학습 수준 진단",
    description: "최소 질문으로 현재 이해도 파악",
    icon: faBullseye,
  },
  {
    title: "맞춤 설명",
    description: "이해도에 맞춘 AI 맞춤 설명",
    icon: faLightbulb,
  },
  {
    title: "지식 그래프",
    description: "나만의 학습 흐름을 한눈에 확인",
    icon: faDiagramProject,
  },
] as const;

const particles = [
  { left: "6%", top: "12%", size: 3, color: "rgba(125, 211, 252, 0.24)" },
  { left: "18%", top: "74%", size: 4, color: "rgba(245, 158, 11, 0.24)" },
  { left: "28%", top: "18%", size: 5, color: "rgba(45, 212, 191, 0.2)" },
  { left: "39%", top: "8%", size: 4, color: "rgba(96, 165, 250, 0.18)" },
  { left: "47%", top: "72%", size: 3, color: "rgba(255, 255, 255, 0.2)" },
  { left: "58%", top: "16%", size: 3, color: "rgba(52, 211, 153, 0.2)" },
  { left: "66%", top: "10%", size: 4, color: "rgba(56, 189, 248, 0.14)" },
  { left: "73%", top: "26%", size: 5, color: "rgba(245, 158, 11, 0.2)" },
  { left: "78%", top: "66%", size: 4, color: "rgba(124, 103, 255, 0.3)" },
  { left: "90%", top: "22%", size: 5, color: "rgba(124, 103, 255, 0.22)" },
  { left: "92%", top: "76%", size: 4, color: "rgba(45, 212, 191, 0.18)" },
  { left: "12%", top: "56%", size: 2, color: "rgba(255, 255, 255, 0.24)" },
  { left: "24%", top: "34%", size: 2, color: "rgba(255, 255, 255, 0.16)" },
  { left: "34%", top: "48%", size: 2, color: "rgba(255, 255, 255, 0.18)" },
  { left: "54%", top: "42%", size: 2, color: "rgba(255, 255, 255, 0.16)" },
  { left: "70%", top: "82%", size: 2, color: "rgba(255, 255, 255, 0.2)" },
  { left: "84%", top: "52%", size: 2, color: "rgba(255, 255, 255, 0.18)" },
] as const;

export function HowItWorksSection() {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % cards.length);
    }, INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <section
      id="how-it-works"
      className="relative z-20 min-h-screen snap-start overflow-hidden scroll-mt-24 bg-[#2A2B2E]"
    >
      <div className="absolute inset-0" aria-hidden="true">
        {particles.map((particle, index) => (
          <span
            key={`${particle.left}-${particle.top}-${index}`}
            className="absolute rounded-full blur-[0.4px]"
            style={{
              left: particle.left,
              top: particle.top,
              width: `${particle.size * 2}px`,
              height: `${particle.size * 2}px`,
              backgroundColor: particle.color,
              boxShadow: `0 0 ${particle.size * 8}px ${particle.color}`,
            }}
          />
        ))}
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-[1680px] flex-col items-center justify-center px-4 py-24 text-center md:px-6 lg:px-8">
        <span className="inline-flex rounded-full bg-[#494261] px-12 py-3 text-[0.88rem] font-semibold text-[#8d7aff]">
          이용 방법
        </span>
        <h2 className="mt-7 text-[2.35rem] font-extrabold tracking-[-0.05em] text-white md:text-[2.8rem]">
          이음, 이렇게 사용해요
        </h2>
        <p className="mt-4 text-[0.94rem] text-white/34 md:text-[0.98rem]">
          자료 업로드부터 맞춤 설명까지 4단계로 완성됩니다.
        </p>
        <div className="mt-8 h-[1.5px] w-full max-w-[600px] bg-[#6f59e8]/40" />

        <div className="mt-12 grid w-full gap-6 md:grid-cols-2 xl:grid-cols-4">
          {cards.map((card, index) => {
            const isActive = index === activeIndex;

            return (
              <article
                key={card.title}
                className={[
                  "relative overflow-hidden rounded-[28px] border px-8 py-10 text-left transition-all duration-700 ease-out",
                  "bg-[#4A4A4F] shadow-[0_18px_48px_rgba(0,0,0,0.14)]",
                  isActive
                    ? "scale-[1.03] border-white/14 opacity-100 blur-0 brightness-100"
                    : "scale-[0.985] border-white/6 opacity-[0.52] blur-[1.2px] brightness-[0.68]",
                ].join(" ")}
                style={{
                  filter: isActive ? "blur(0px) brightness(1)" : "blur(1.2px) brightness(0.68)",
                }}
              >
                <span className="absolute inset-y-6 left-0 w-[4px] rounded-full bg-[#7c67ff]" />
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#625886] text-[2rem] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                    <FontAwesomeIcon icon={card.icon} className="h-8 w-8 text-white" />
                  </div>
                  <div>
                    <h3 className="text-[1.3rem] font-extrabold tracking-[-0.05em] text-white md:text-[1.3rem]">
                      {card.title}
                    </h3>
                    <p className="mt-2 text-[0.9rem] text-white/32 md:text-[0.95rem]">{card.description}</p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
