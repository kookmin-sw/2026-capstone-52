"use client";

import { MiniGraphFloat } from "@/components/graph/mini-graph-float";
import type { KnowledgeGraphEdge, KnowledgeGraphNode } from "@/components/graph/knowledge-graph-scene";
import { motion, type Variants } from "framer-motion";
import { useEffect, useState, type ReactNode } from "react";

const introItemVariants: Variants = {
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

function FeatureCard({
  iconSrc,
  title,
  description,
  children,
  animationIndex,
}: {
  iconSrc: string;
  title: string;
  description: string;
  children: ReactNode;
  animationIndex: number;
}) {
  return (
    <motion.article
      className="rounded-[1.65rem] border border-[#e8e5f2] bg-white/92 px-7 py-7 shadow-[0_26px_70px_rgba(42,38,73,0.06)] backdrop-blur md:px-9 md:py-9 2xl:px-11 2xl:py-11"
      variants={introItemVariants}
      custom={animationIndex}
    >
      <img src={iconSrc} alt="" aria-hidden="true" className="h-14 w-14 2xl:h-[4.25rem] 2xl:w-[4.25rem]" />
      <h3 className="mt-6 text-[1.35rem] font-black tracking-normal text-[#24213d] 2xl:text-[1.55rem]">{title}</h3>
      <p className="mt-4 text-[0.92rem] font-medium leading-7 text-[#74708b] 2xl:text-[1rem] 2xl:leading-8">{description}</p>
      <div className="mt-7">{children}</div>
    </motion.article>
  );
}

function DiagnosisPreview() {
  return (
    <div className="rounded-[1rem] bg-[#f0eefb] px-5 py-4 text-[0.86rem] leading-6">
      <p className="font-black text-[#24213d]">스택(Stack)의 동작 방식으로 올바른 것은?</p>
      <p className="font-bold text-[#817cf2]">C. 마지막에 들어온 데이터가 먼저 나옵니다.</p>
    </div>
  );
}

function ExplanationPreview() {
  return (
    <div className="rounded-[1rem] bg-[#f0eefb] px-5 py-4 text-[0.86rem] font-medium leading-6 text-[#24213d]">
      스택은 접시를 쌓는 것처럼{" "}
      <strong className="font-black">마지막에 올린 것부터</strong> 꺼내는 구조예요.
    </div>
  );
}

const miniGraphPreviewNodes: KnowledgeGraphNode[] = [
  { id: "sched", label: "스케줄링", color: "#817cf2", x: 0.32, y: 0.5, size: 6.4, isCore: true },
  { id: "fcfs", label: "FCFS", color: "#62ceb0", x: 0.55, y: 0.34, size: 5.1 },
  { id: "rr", label: "RR", color: "#ff9a72", x: 0.55, y: 0.66, size: 5.1 },
  { id: "starv", label: "기아 현상", color: "#f36f7b", x: 0.74, y: 0.5, size: 5.1 },
  { id: "aging", label: "에이징", color: "#7dd3fc", x: 0.72, y: 0.28, size: 4.5 },
  { id: "preempt", label: "선점형", color: "#c4b5fd", x: 0.38, y: 0.27, size: 4.5 },
];

const miniGraphPreviewEdges: KnowledgeGraphEdge[] = [
  { source: "sched", target: "fcfs" },
  { source: "sched", target: "rr" },
  { source: "fcfs", target: "starv" },
  { source: "rr", target: "starv" },
  { source: "starv", target: "aging" },
  { source: "sched", target: "preempt" },
];

function MiniGraphPreview() {
  return (
    <div
      className="relative h-[220px] overflow-hidden rounded-[1rem] bg-[#f0eefb]"
      role="img"
      aria-label="스케줄링, FCFS, RR, 기아 현상이 연결된 지식 그래프"
    >
      <MiniGraphFloat
        nodes={miniGraphPreviewNodes}
        edges={miniGraphPreviewEdges}
        showLabels
        nodeSizeScale={1.7}
      />
    </div>
  );
}

type Phase = "idle" | "selecting1" | "selecting2" | "reveal";

const miniQuizOptions = [
  { id: "A", text: "마지막 데이터가 먼저 나온다", isCorrect: true },
  { id: "B", text: "먼저 데이터가 먼저 나온다", isCorrect: false },
  { id: "C", text: "push / pop 연산을 사용한다", isCorrect: true },
  { id: "D", text: "트리 형태의 자료구조이다", isCorrect: false },
];

const miniQuizPhaseDuration: Record<Phase, number> = {
  idle: 520,
  selecting1: 600,
  selecting2: 700,
  reveal: 1300,
};

const nextMiniQuizPhase: Record<Phase, Phase> = {
  idle: "selecting1",
  selecting1: "selecting2",
  selecting2: "reveal",
  reveal: "idle",
};

const miniQuizTone = {
  default: {
    backgroundColor: "#f0eefb",
    color: "#24213d",
  },
  selected: {
    backgroundColor: "#dcd6ff",
    color: "#5a4fd9",
  },
  correct: {
    backgroundColor: "#d4f5e6",
    color: "#10b981",
  },
  wrong: {
    backgroundColor: "#fde2e4",
    color: "#ef4444",
  },
};

function getMiniQuizOptionTone(option: (typeof miniQuizOptions)[number], phase: Phase) {
  const isSelected =
    (phase === "selecting1" && option.id === "A") ||
    ((phase === "selecting2" || phase === "reveal") && (option.id === "A" || option.id === "B"));
  const isRevealed = phase === "reveal";

  if (isRevealed && option.isCorrect) {
    return miniQuizTone.correct;
  }

  if (isRevealed && isSelected && !option.isCorrect) {
    return miniQuizTone.wrong;
  }

  if (isSelected) {
    return miniQuizTone.selected;
  }

  return miniQuizTone.default;
}

function MiniQuizPreview() {
  const [phase, setPhase] = useState<Phase>("idle");

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setPhase(nextMiniQuizPhase[phase]);
    }, miniQuizPhaseDuration[phase]);

    return () => window.clearTimeout(timeout);
  }, [phase]);

  return (
    <div className="rounded-[1rem]" aria-label="스택 개념 미니퀴즈 미리보기">
      <div
        className="rounded-[1rem] border border-[#ece9f7] bg-white px-4 py-4 shadow-[0_8px_24px_rgba(42,38,73,0.08)]"
      >
        <p className="text-[0.86rem] font-black leading-6 text-[#24213d]">
          스택(Stack)에 대한 설명으로 옳은 것을 모두 고르세요
        </p>

        <div className="mt-3 grid grid-cols-2 gap-2">
          {miniQuizOptions.map((option) => {
            const tone = getMiniQuizOptionTone(option, phase);
            const isWrongReveal = phase === "reveal" && option.id === "B";

            return (
              <motion.div
                key={option.id}
                className="rounded-[0.7rem] bg-[#f0eefb] px-3 py-2.5 text-left text-[0.78rem] font-bold leading-5 text-[#24213d]"
                animate={{
                  ...tone,
                  x: isWrongReveal ? [0, -6, 6, -6, 6, -3, 3, 0] : 0,
                }}
                transition={isWrongReveal ? { duration: 0.5 } : { duration: 0.22 }}
              >
                {option.id}. {option.text}
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function IntroSection() {
  return (
    <section
      id="intro"
      className="relative z-20 min-h-screen scroll-mt-24 overflow-hidden text-[#24213d]"
    >
      <motion.div
        className="relative mx-auto flex min-h-screen max-w-[1800px] flex-col justify-center px-6 py-24 md:px-12 xl:px-[4.7rem]"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.28 }}
      >
        <div className="mx-auto max-w-[880px] text-center">
          <motion.span
            className="inline-flex rounded-full bg-[#f0edff] px-[1.125rem] py-2 text-[0.84rem] font-bold text-[#817cf2]"
            variants={introItemVariants}
            custom={0}
          >
            서비스 소개
          </motion.span>
          <motion.h2
            className="mt-7 text-[2.55rem] font-black leading-[1.22] tracking-normal text-[#24213d] md:text-[3.15rem] 2xl:text-[3.75rem]"
            variants={introItemVariants}
            custom={1}
          >
            이음은 자료와 대화를 연결해
            <br />
            나만의 학습 지도를 만들어갑니다
          </motion.h2>
          <motion.p
            className="mt-6 text-[0.98rem] font-medium leading-8 text-[#74708b] 2xl:text-[1.06rem] 2xl:leading-9"
            variants={introItemVariants}
            custom={2}
          >
            단순히 답을 알려주는 것이 아니라, 업로드한 자료에서 개념을 추출하고 질문을 통해 현재 이해도를 확인한 뒤
            <br className="hidden md:block" />
            부족한 개념부터 자연스럽게 이어 설명합니다.
          </motion.p>
        </div>

        <div className="mx-auto mt-20 grid w-full max-w-[1400px] gap-6 md:grid-cols-2 2xl:gap-7">
          <FeatureCard
            iconSrc="/icons/landing/landing_target.svg"
            title="학습 출발점 체크"
            description="최소 질문으로 현재 학습 상태를 확인하고, 이해·추가 학습·미진단 개념을 구분합니다."
            animationIndex={3}
          >
            <DiagnosisPreview />
          </FeatureCard>

          <FeatureCard
            iconSrc="/icons/landing/landing_explain.svg"
            title="내 수준에 맞는 설명"
            description="진단 결과와 대화 맥락을 반영해 너무 쉽지도 어렵지도 않은 설명을 제공합니다."
            animationIndex={4}
          >
            <ExplanationPreview />
          </FeatureCard>

          <FeatureCard
            iconSrc="/icons/landing/landing_graph.svg"
            title="프로젝트별 지식 그래프"
            description="운영체제, 자료구조처럼 프로젝트별로 학습한 개념과 관계를 그래프로 볼 수 있습니다."
            animationIndex={5}
          >
            <MiniGraphPreview />
          </FeatureCard>

          <FeatureCard
            iconSrc="/icons/landing/quiz.svg"
            title="개념 확인 미니퀴즈"
            description="대화에서 충분히 다룬 개념을 짧은 퀴즈로 점검하고, 헷갈린 선택지는 바로 피드백합니다."
            animationIndex={6}
          >
            <MiniQuizPreview />
          </FeatureCard>
        </div>
      </motion.div>
    </section>
  );
}
