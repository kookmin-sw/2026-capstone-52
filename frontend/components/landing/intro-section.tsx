const particles = [
  "left-[12%] top-[18%] h-2 w-2",
  "left-[24%] top-[68%] h-1.5 w-1.5",
  "left-[36%] top-[34%] h-1 w-1",
  "left-[48%] top-[74%] h-2.5 w-2.5",
  "left-[60%] top-[22%] h-1.5 w-1.5",
  "left-[72%] top-[58%] h-1 w-1",
  "left-[82%] top-[30%] h-2 w-2",
  "left-[88%] top-[70%] h-1.5 w-1.5"
];

export function IntroSection() {
  return (
    <section
      id="intro"
      className="relative isolate snap-start scroll-mt-24"
    >
      <div className="relative min-h-[calc(100vh-78px)]">
        {/* Section 2 is the reveal window: it stays above the pinned graph layer but does not own that graph. */}
        <div className="relative mx-auto flex min-h-[calc(100vh-78px)] max-w-[1440px] flex-col justify-between overflow-hidden px-6 pb-14 pt-24 text-center">
          <div className="absolute inset-0 z-[1] bg-[linear-gradient(180deg,rgba(42,43,46,0.16)_0%,rgba(42,43,46,0.05)_24%,rgba(42,43,46,0.03)_52%,rgba(42,43,46,0.09)_100%)]" />

          <div className="absolute inset-0 z-[2]">
            <div className="landing-ambient-orb absolute left-[-6%] top-[2%] h-[340px] w-[340px] bg-[#8e5d2f]/24 blur-3xl" />
            <div className="landing-ambient-orb-slow absolute left-[29%] top-[0%] h-[470px] w-[470px] bg-[#4a86ad]/24 blur-3xl" />
            <div className="landing-ambient-orb absolute bottom-[8%] left-[13%] h-[320px] w-[320px] bg-[#4b7b4d]/20 blur-3xl" />
            <div className="landing-ambient-orb-slower absolute bottom-[22%] right-[22%] h-[290px] w-[290px] bg-[#3f7f82]/18 blur-3xl" />
            <div className="landing-ambient-orb absolute bottom-[12%] right-[-1%] h-[330px] w-[330px] bg-[#6650a6]/22 blur-3xl" />
            {particles.map((particle, index) => (
              <span
                key={particle}
                className={`landing-particle absolute rounded-full bg-white/28 ${particle}`}
                style={{ animationDelay: `${index * 1.3}s` }}
              />
            ))}
          </div>

          <div className="flex-1" />

          <div className="relative z-10 max-w-[1180px] self-center">
            {/* 랜딩 페이지 2번째 슬라이드(서비스 소개) 메인 카피 "이음은 사용자의 현재 이해 수준을 진단하고..." 문장입니다. 글씨 크기/굵기는 아래 className에서 수정하세요. */}
            <h2 className="text-[2.6rem] font-bold leading-[1.45] tracking-[-0.05em] text-white xl:text-[3rem]">
              이음은 사용자의 현재 이해 수준을 진단하고,
              <br />
              프로젝트별 지식 그래프를 쌓아가며 맞춤 설명을 제공하는
              <br />
              AI 튜터 서비스입니다.
            </h2>
          </div>

          <div className="flex-1" />

          {/* 랜딩 페이지 2번째 슬라이드(서비스 소개) 하단 스크롤 안내 "이음 더 알아보기" 텍스트입니다. 글씨 크기는 아래 className에서 수정하세요. */}
          <div className="relative z-10 flex flex-col items-center gap-3 text-center text-[1rem] text-white/28">
            <span>이음 더 알아보기</span>
            <span className="landing-scroll-indicator" aria-hidden="true" />
          </div>
        </div>
      </div>
    </section>
  );
}
