import { faBookOpen } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { CSSProperties, ReactNode } from "react";
import { LandingGraphLayer } from "./landing-graph-layer";

const quizOptions = [
  "A. 먼저 들어온 데이터가 먼저 나온다.",
  "B. 랜덤한 순서로 데이터가 나온다.",
  "C. 마지막에 들어온 데이터가 먼저 나온다.",
  "D. 입력한 순서와 상관없이 크기 순으로 나온다."
];

function SectionCard({
  children,
  accentClassName,
  className = ""
}: {
  children: ReactNode;
  accentClassName: string;
  className?: string;
}) {
  return (
    <article
      className={`rounded-[30px] border bg-[#303137]/94 p-6 shadow-[0_18px_60px_rgba(5,6,10,0.18)] backdrop-blur-sm md:p-8 ${accentClassName} ${className}`}
    >
      {children}
    </article>
  );
}

function Pill({
  children,
  className
}: {
  children: ReactNode;
  className: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-4 py-2 text-[0.76rem] font-semibold tracking-[-0.02em] ${className}`}
    >
      {children}
    </span>
  );
}

function SectionHeading({
  badge,
  badgeClassName,
  title,
  description
}: {
  badge: string;
  badgeClassName: string;
  title: ReactNode;
  description: ReactNode;
}) {
  return (
    <div>
      <Pill className={badgeClassName}>{badge}</Pill>
      <h3 className="mt-5 text-[2rem] font-extrabold leading-[1.08] tracking-[-0.05em] text-white md:text-[2.35rem]">
        {title}
      </h3>
      <p className="mt-5 max-w-[35rem] text-[0.98rem] leading-7 text-[#abaeb8]">
        {description}
      </p>
    </div>
  );
}

function QuizOption({
  label,
  active
}: {
  label: string;
  active?: boolean;
}) {
  return (
    <div
      className={`rounded-[12px] border px-4 py-3 text-[0.84rem] font-medium leading-5 transition-colors ${
        active
          ? "border-[#54d488] bg-[#2f473c] text-[#7debab] shadow-[0_0_0_1px_rgba(84,212,136,0.15)]"
          : "border-white/5 bg-[#37383e] text-[#c6c8cf]/80"
      }`}
    >
      {label}
    </div>
  );
}

function QuizCard() {
  return (
    <div className="mt-10 rounded-[28px] bg-[#56575e] px-4 py-5 md:px-6 md:py-6">
      <p className="text-[1.02rem] font-bold tracking-[-0.02em] text-white md:text-[1.06rem]">
        스택(Stack)의 동작 방식으로 올바른 것은?
      </p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {quizOptions.map((label, index) => (
          <QuizOption key={label} label={label} active={index === 2} />
        ))}
      </div>
    </div>
  );
}

function GraphCanvas() {
  return (
    <div className="relative mt-8 h-[220px] overflow-hidden rounded-[22px] border border-white/5 bg-[#14151d] md:h-[250px]">
      <LandingGraphLayer compact />
    </div>
  );
}

function ChatBubble({
  align = "left",
  children
}: {
  align?: "left" | "right";
  children: ReactNode;
}) {
  const isRight = align === "right";

  return (
    <div className={`flex ${isRight ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[82%] rounded-[18px] px-5 py-4 text-[0.88rem] leading-7 ${
          isRight
            ? "bg-[#6448aa] text-white shadow-[0_10px_26px_rgba(100,72,170,0.18)]"
            : "bg-[#5a5b63] text-[#e2e3e8]"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

function GraphFeatureCard() {
  return (
    <SectionCard
      accentClassName="border-[#44658e]/75 shadow-[0_18px_60px_rgba(19,34,60,0.18)]"
      className="bg-[#343439]"
    >
      <SectionHeading
        badge="학습 흐름 확인"
        badgeClassName="bg-[#30465f] text-[#78aff5]"
        title={
          <>
            프로젝트별 지식 그래프
          </>
        }
        description={
          <>
            학습한 내용이 그래프로 연결되어
            <br />
            개념 간 관계를 한눈에 시각적으로 확인할 수 있어요.
          </>
        }
      />
      <GraphCanvas />
    </SectionCard>
  );
}

function DiagnosisFeatureCard() {
  return (
    <SectionCard
      accentClassName="border-[#426a58]/80 shadow-[0_18px_60px_rgba(18,42,27,0.16)]"
      className="bg-[#343439]"
    >
      <SectionHeading
        badge="학습 출발점 체크"
        badgeClassName="bg-[#375948] text-[#7ae2a5]"
        title={
          <>
            최소 질문으로
            <br />
            현재 학습 상태 확인
          </>
        }
        description="AI가 몇 가지 질문으로 지금 나의 이해도를 파악해요."
      />
      <QuizCard />
    </SectionCard>
  );
}

function AiHeader() {
  return (
    <div className="flex items-center gap-3">
      <span className="h-7 w-7 rounded-full bg-[#6d58df]" />
      <div>
        <p className="text-[0.82rem] font-semibold text-[#8a72ff]">이음 AI</p>
      </div>
    </div>
  );
}

function ChatFeatureCard() {
  return (
    <SectionCard
      accentClassName="border-[#58479e]/80 shadow-[0_18px_60px_rgba(53,32,88,0.18)]"
      className="flex h-full flex-col bg-[#343439]"
    >
      <SectionHeading
        badge="나에게 맞는 설명"
        badgeClassName="bg-[#42325e] text-[#a586ff]"
        title={
          <>
            내 수준에 맞는 맞춤 설명
          </>
        }
        description={
          <>
            진단 결과를 바탕으로 너무 어렵지도, 쉽지도 않은
            <br />
            나에게 딱 맞는 설명을 제공해요.
          </>
        }
      />

      <div className="mt-8 flex flex-1 flex-col rounded-[16px] bg-[#4e4f57] p-4 md:p-5">
        <div className="flex flex-1 flex-col overflow-hidden bg-[#34353c]">
          <div className="bg-[#2b2c31] px-5 py-4 text-center text-[1rem] font-semibold tracking-[-0.03em] text-white">
            운영체제 - 프로세스 스케줄링
          </div>

          <div className="flex flex-1 flex-col p-6 md:p-7">
            <div className="space-y-6">
            <ChatBubble>
              <div>
                <AiHeader />
                <p className="mt-3">
                  <span className="font-semibold">
                    스택(Stack)은 접시를 쌓는 것과 같은 자료구조입니다.
                  </span>
                  <br />
                  사용자님 수준에 맞게 단계별로 설명해드릴게요{" "}
                  <FontAwesomeIcon icon={faBookOpen} className="text-[0.95em] text-[#8a72ff]" />
                </p>
              </div>
            </ChatBubble>

            <ChatBubble align="right">
              그럼 큐(Queue)랑 반대인 건가요?
            </ChatBubble>

            <ChatBubble>
              맞아요! 큐는 먼저 넣은 게 먼저 나오는 FIFO 구조예요.
              <br />
              이 흐름으로 이해하면 좋아요:
              <br />
              스택 → 큐 → Deque
            </ChatBubble>
          </div>

            <div className="mt-auto pt-14">
              <div className="flex items-center gap-3 rounded-full bg-[#5a5b63] px-4 py-3.5">
                <span className="flex-1 text-[0.92rem] text-[#d2d3d8]/60">
                  질문을 입력하세요.
                </span>
                <button
                  type="button"
                  aria-label="질문 전송"
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-[#7a58ff] text-lg text-white shadow-[0_8px_20px_rgba(122,88,255,0.28)] transition-transform duration-300 hover:scale-[1.03]"
                >
                  →
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

function ParticleField() {
  const styles: CSSProperties[] = [
    { left: "6%", top: "10%", backgroundColor: "rgba(122,88,255,0.18)" },
    { left: "12%", top: "78%", backgroundColor: "rgba(80,160,255,0.14)" },
    { left: "26%", top: "18%", backgroundColor: "rgba(122,88,255,0.12)" },
    { left: "34%", top: "62%", backgroundColor: "rgba(92,208,152,0.12)" },
    { left: "52%", top: "12%", backgroundColor: "rgba(92,208,152,0.14)" },
    { left: "63%", top: "84%", backgroundColor: "rgba(241,172,88,0.12)" },
    { left: "74%", top: "24%", backgroundColor: "rgba(80,160,255,0.14)" },
    { left: "82%", top: "68%", backgroundColor: "rgba(122,88,255,0.12)" },
    { left: "91%", top: "16%", backgroundColor: "rgba(92,208,152,0.12)" }
  ];

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {styles.map((style, index) => (
        <span
          key={`${style.left}-${style.top}`}
          className={`absolute rounded-full ${
            index % 3 === 0 ? "h-2.5 w-2.5 blur-[1px]" : index % 2 === 0 ? "h-1.5 w-1.5" : "h-2 w-2"
          }`}
          style={style}
        />
      ))}
    </div>
  );
}

export function CoreFeaturesSection() {
  return (
    <section
      id="features"
      className="relative z-20 snap-start scroll-mt-24 overflow-hidden bg-[#2A2B2E]"
    >
      <ParticleField />
      <div className="mx-auto flex min-h-[calc(100vh-78px)] max-w-[1440px] items-center px-5 py-12 md:px-8 lg:px-10">
        {/* 데스크탑에서는 좌측 2장 스택과 우측 세로 카드 비율을 유지하고, 작은 화면에서는 자연스럽게 세로로 쌓습니다. */}
        <div className="grid w-full gap-5 xl:grid-cols-[1.08fr_0.92fr]">
          <div className="grid gap-5">
            <DiagnosisFeatureCard />
            <GraphFeatureCard />
          </div>
          <ChatFeatureCard />
        </div>
      </div>
    </section>
  );
}
