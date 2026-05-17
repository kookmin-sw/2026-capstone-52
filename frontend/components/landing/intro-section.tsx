import { motion, type Variants } from "framer-motion";
import type { ReactNode } from "react";

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

function MiniGraphPreview() {
  return (
    <div className="relative h-[171px] overflow-hidden rounded-[1rem] bg-[#f0eefb]">
      <svg className="h-full w-full" viewBox="0 0 600 172" role="img" aria-label="스케줄링, FCFS, RR, 기아현상이 연결된 지식 그래프">
        <defs>
          <filter id="landing-graph-node-shadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="8" stdDeviation="8" floodColor="#4d467a" floodOpacity="0.12" />
          </filter>
        </defs>

        <g fill="none" stroke="#bdb7f7" strokeLinecap="round" strokeWidth="4">
          <path d="M152 88 C218 62 266 50 326 48" />
          <path d="M152 88 C218 104 264 118 326 122" />
          <path d="M382 122 C430 112 466 100 518 86" />
        </g>

        <g filter="url(#landing-graph-node-shadow)">
          <g transform="translate(118 88)">
            <circle r="30" fill="#817cf2" />
            <text y="4" fill="#fff" fontSize="10.5" fontWeight="850" textAnchor="middle">스케줄링</text>
          </g>

          <g transform="translate(352 46)">
            <circle r="31" fill="#62ceb0" />
            <text y="5" fill="#fff" fontSize="13" fontWeight="850" textAnchor="middle">FCFS</text>
          </g>

          <g transform="translate(352 124)">
            <circle r="31" fill="#ff9a72" />
            <text y="5" fill="#fff" fontSize="13" fontWeight="850" textAnchor="middle">RR</text>
          </g>

          <g transform="translate(536 84)">
            <circle r="31" fill="#f36f7b" />
            <text y="4" fill="#fff" fontSize="10.5" fontWeight="850" textAnchor="middle">기아 현상</text>
          </g>
        </g>
      </svg>
    </div>
  );
}

function LogPreview() {
  return (
    <div className="space-y-2.5">
      {["기아 현상", "에이징", "Round Robin"].map((item, index) => (
        <div
          key={item}
          className={`rounded-[0.85rem] bg-[#f0eefb] px-4 py-3.5 text-[0.86rem] font-black ${
            index === 0 ? "text-[#817cf2]" : "text-[#24213d]"
          }`}
        >
          {item}
        </div>
      ))}
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
            iconSrc="/icons/landing/landing_report.svg"
            title="학습 기록과 메모"
            description="최근 업데이트된 개념, 질문 기록, 메모를 함께 남겨 다음 학습으로 이어갑니다."
            animationIndex={6}
          >
            <LogPreview />
          </FeatureCard>
        </div>
      </motion.div>
    </section>
  );
}
