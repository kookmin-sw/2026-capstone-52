function TutorAppMockup() {
  return (
    <div className="relative mx-auto w-full max-w-[860px]">
      <div className="landing-ambient-orb absolute left-[40%] top-[46%] h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 bg-[#7f6dbe]/26 blur-3xl" />
      <img
        src="/images/hero-workspace-mock.png"
        alt="eeum workspace mockup"
        width={646}
        height={396}
        className="relative z-10 h-auto w-full"
      />
    </div>
  );
}

export function HeroSection() {
  return (
    <section
      id="hero"
      className="relative z-20 snap-start overflow-hidden scroll-mt-24 bg-[#2A2B2E]"
    >
      <div className="mx-auto flex min-h-[calc(100vh-78px)] max-w-[1440px] flex-col justify-center px-3 pb-14 pt-10">
        <div className="grid items-center gap-12 lg:grid-cols-[0.84fr_1.16fr]">
          <div className="relative z-10 max-w-[700px]">
            {/* 랜딩 페이지 1번째 슬라이드(Hero) 메인 제목 "나에게 맞는 설명으로, 배움을 그래프로 잇다" 입니다. 글씨 크기/굵기는 아래 className에서 수정하세요. */}
            <h1 className="text-[3.2rem] font-semibold leading-[1.2] tracking-[-0.05em] text-white ㅣ:text-[4.2rem]">
              나에게 맞는 설명으로,
              <br />
              배움을 그래프로 잇다
            </h1>
            {/* 랜딩 페이지 1번째 슬라이드(Hero) 서브 설명 "AI가 내 학습 수준을 파악하고..." 문장입니다. 글씨 크기/줄간격은 아래 className에서 수정하세요. */}
            <p className="mt-8 max-w-[620px] text-[1.1rem] leading-8 text-white/34">
              AI가 내 학습 수준을 파악하고, 지식 그래프를 쌓아가며
              <br />
              나만의 맞춤 설명을 제공하는 AI 튜터 서비스
            </p>
            <div className="mt-12 flex flex-wrap items-center gap-4">
              <a
                href="/dashboard"
                /* 랜딩 페이지 1번째 슬라이드(Hero) CTA 버튼 "시작하기" 입니다. 버튼 크기/글씨 크기는 아래 className에서 수정하세요. */
                className="inline-flex items-center rounded-full bg-[#7c67ff] px-7 py-4 text-[1.25rem] font-bold text-white transition hover:bg-[#8d7aff]"
              >
                시작하기 <span className="ml-2">→</span>
              </a>
            </div>
          </div>

          <TutorAppMockup />
        </div>

        {/* 랜딩 페이지 1번째 슬라이드(Hero) 하단 스크롤 안내 "↓ 스크롤하여 더 알아보기" 텍스트입니다. 크기는 아래 className에서 수정하세요. */}
        <div className="mt-14 flex flex-col items-center gap-3 text-center text-[1rem] text-white/30">
          <span>↓ 스크롤하여 더 알아보기</span>
          <span className="landing-scroll-indicator" aria-hidden="true" />
        </div>
      </div>
    </section>
  );
}
