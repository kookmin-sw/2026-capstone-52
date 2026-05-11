import {
  faBullseye,
  faDiagramProject,
  faFileLines,
  faWandMagicSparkles,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { ReactNode } from "react";

function FeatureCard({
  icon,
  iconClassName,
  title,
  description,
  children,
}: {
  icon: typeof faBullseye;
  iconClassName: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <article className="rounded-[1.65rem] border border-[#e8e5f2] bg-white/92 px-7 py-7 shadow-[0_26px_70px_rgba(42,38,73,0.06)] backdrop-blur md:px-9 md:py-9 2xl:px-11 2xl:py-11">
      <div
        className={`flex h-14 w-14 items-center justify-center rounded-[1.05rem] text-[1.22rem] 2xl:h-[4.25rem] 2xl:w-[4.25rem] ${iconClassName}`}
      >
        <FontAwesomeIcon icon={icon} className="h-5.5 w-5.5 2xl:h-7 2xl:w-7" />
      </div>
      <h3 className="mt-6 text-[1.35rem] font-black tracking-normal text-[#24213d] 2xl:text-[1.55rem]">{title}</h3>
      <p className="mt-4 text-[0.92rem] font-medium leading-7 text-[#74708b] 2xl:text-[1rem] 2xl:leading-8">{description}</p>
      <div className="mt-7">{children}</div>
    </article>
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
  const nodes = [
    { label: "스케줄링", className: "left-[16%] top-[43%] bg-[#817cf2]" },
    { label: "FCFS", className: "left-[43%] top-[21%] bg-[#62ceb0]" },
    { label: "RR", className: "left-[43%] top-[58%] bg-[#ff9a72]" },
    { label: "기아 현상", className: "left-[73%] top-[45%] bg-[#f36f7b]" },
  ] as const;

  return (
    <div className="relative h-[171px] overflow-hidden rounded-[1rem] bg-[#f0eefb]">
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 460 150" aria-hidden="true">
        <line x1="122" y1="77" x2="223" y2="50" stroke="#c7c1fa" strokeWidth="3" />
        <line x1="122" y1="77" x2="224" y2="100" stroke="#c7c1fa" strokeWidth="3" />
        <line x1="246" y1="100" x2="356" y2="78" stroke="#c7c1fa" strokeWidth="3" />
      </svg>
      {nodes.map((node) => (
        <span
          key={node.label}
          className={`absolute flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full px-2 text-center text-[0.74rem] font-black leading-4 text-white ${node.className}`}
        >
          {node.label}
        </span>
      ))}
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
      <div className="relative mx-auto flex min-h-screen max-w-[1800px] flex-col justify-center px-6 py-24 md:px-12 xl:px-[4.7rem]">
        <div className="mx-auto max-w-[880px] text-center">
          <span className="inline-flex rounded-full bg-[#f0edff] px-[1.125rem] py-2 text-[0.84rem] font-bold text-[#817cf2]">
            서비스 소개
          </span>
          <h2 className="mt-7 text-[2.55rem] font-black leading-[1.22] tracking-normal text-[#24213d] md:text-[3.15rem] 2xl:text-[3.75rem]">
            이음은 자료와 대화를 연결해
            <br />
            나만의 학습 지도를 만들어갑니다
          </h2>
          <p className="mt-6 text-[0.98rem] font-medium leading-8 text-[#74708b] 2xl:text-[1.06rem] 2xl:leading-9">
            단순히 답을 알려주는 것이 아니라, 업로드한 자료에서 개념을 추출하고 질문을 통해 현재 이해도를 확인한 뒤
            <br className="hidden md:block" />
            부족한 개념부터 자연스럽게 이어 설명합니다.
          </p>
        </div>

        <div className="mx-auto mt-20 grid w-full max-w-[1400px] gap-6 md:grid-cols-2 2xl:gap-7">
          <FeatureCard
            icon={faBullseye}
            iconClassName="bg-[#ebe8ff] text-[#817cf2]"
            title="학습 출발점 체크"
            description="최소 질문으로 현재 학습 상태를 확인하고, 이해·추가 학습·미진단 개념을 구분합니다."
          >
            <DiagnosisPreview />
          </FeatureCard>

          <FeatureCard
            icon={faWandMagicSparkles}
            iconClassName="bg-[#ffe3d3] text-[#ff8a62]"
            title="내 수준에 맞는 설명"
            description="진단 결과와 대화 맥락을 반영해 너무 쉽지도 어렵지도 않은 설명을 제공합니다."
          >
            <ExplanationPreview />
          </FeatureCard>

          <FeatureCard
            icon={faDiagramProject}
            iconClassName="bg-[#d9f7ea] text-[#60d3a7]"
            title="프로젝트별 지식 그래프"
            description="운영체제, 자료구조처럼 프로젝트별로 학습한 개념과 관계를 그래프로 볼 수 있습니다."
          >
            <MiniGraphPreview />
          </FeatureCard>

          <FeatureCard
            icon={faFileLines}
            iconClassName="bg-[#d9eaff] text-[#72a9f6]"
            title="학습 기록과 메모"
            description="최근 업데이트된 개념, 질문 기록, 메모를 함께 남겨 다음 학습으로 이어갑니다."
          >
            <LogPreview />
          </FeatureCard>
        </div>
      </div>
    </section>
  );
}
