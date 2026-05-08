<style>
  :root {
    --eeum-bg: #2a2b2e;
    --eeum-panel: #303137;
    --eeum-panel-deep: #292a2f;
    --eeum-panel-soft: #343439;
    --eeum-card: rgba(255, 255, 255, 0.06);
    --eeum-card-strong: rgba(255, 255, 255, 0.1);
    --eeum-text: #f2f1f7;
    --eeum-muted: rgba(255, 255, 255, 0.56);
    --eeum-subtle: rgba(255, 255, 255, 0.34);
    --eeum-purple: #7c67ff;
    --eeum-purple-strong: #8f5bff;
    --eeum-purple-soft: rgba(124, 103, 255, 0.22);
    --eeum-blue: #78aff5;
    --eeum-green: #7ae2a5;
    --eeum-amber: #f1ac58;
    --eeum-line: rgba(255, 255, 255, 0.08);
  }

  body {
    background: var(--eeum-bg) !important;
    color: var(--eeum-text) !important;
    font-family: "Pretendard Variable", "SUIT Variable", "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif !important;
  }

  #header_wrap,
  #footer_wrap {
    display: none;
  }

  #main_content_wrap {
    border: 0;
    background:
      radial-gradient(circle at 12% 8%, rgba(124, 103, 255, 0.2), transparent 30rem),
      radial-gradient(circle at 86% 12%, rgba(120, 175, 245, 0.12), transparent 26rem),
      linear-gradient(180deg, #2a2b2e 0%, #242529 100%);
  }

  #main_content {
    max-width: none;
    padding: 0;
  }

  #main_content h1,
  #main_content h2,
  #main_content h3,
  #main_content h4,
  #main_content h5,
  #main_content h6 {
    color: var(--eeum-text);
    font-family: inherit;
    letter-spacing: 0;
  }

  #main_content p,
  #main_content li {
    color: var(--eeum-muted);
    font-size: 16px;
    line-height: 1.85;
  }

  #main_content a {
    color: inherit;
    text-decoration: none;
  }

  .eeum-page {
    min-height: 100vh;
    color: var(--eeum-text);
  }

  .eeum-section {
    max-width: 1180px;
    margin: 0 auto;
    padding: 72px 24px;
  }

  .eeum-hero {
    position: relative;
    display: grid;
    grid-template-columns: minmax(0, 0.9fr) minmax(420px, 1.1fr);
    gap: 52px;
    align-items: center;
    min-height: 86vh;
    max-width: 1260px;
    margin: 0 auto;
    padding: 72px 24px 56px;
    overflow: hidden;
  }

  .eeum-hero::before,
  .eeum-hero::after {
    content: "";
    position: absolute;
    border-radius: 999px;
    filter: blur(54px);
    pointer-events: none;
  }

  .eeum-hero::before {
    left: -120px;
    top: 120px;
    width: 280px;
    height: 280px;
    background: rgba(142, 93, 47, 0.18);
  }

  .eeum-hero::after {
    right: 4%;
    bottom: 10%;
    width: 360px;
    height: 360px;
    background: rgba(124, 103, 255, 0.18);
  }

  .eeum-hero-copy,
  .eeum-workspace-preview,
  .eeum-section-inner {
    position: relative;
    z-index: 1;
  }

  .eeum-brand {
    display: inline-flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 28px;
    color: var(--eeum-text);
    font-weight: 800;
  }

  .eeum-logo {
    position: relative;
    display: inline-block;
    width: 42px;
    height: 24px;
  }

  .eeum-logo::before {
    content: "";
    position: absolute;
    left: 0;
    top: 2px;
    width: 18px;
    height: 18px;
    border: 5px solid #6c63ff;
    border-radius: 999px;
  }

  .eeum-logo::after {
    content: "";
    position: absolute;
    left: 25px;
    top: 8px;
    width: 13px;
    height: 13px;
    border-radius: 999px;
    background: #6c63ff;
    box-shadow: -10px 5px 0 -3px #6c63ff;
  }

  .eeum-eyebrow {
    display: inline-flex;
    align-items: center;
    border-radius: 999px;
    padding: 8px 14px;
    background: rgba(124, 103, 255, 0.16);
    color: #cbaeff;
    font-size: 13px;
    font-weight: 800;
  }

  .eeum-hero h1 {
    margin: 22px 0 0;
    color: #fff;
    font-size: clamp(42px, 6vw, 76px);
    font-weight: 760;
    line-height: 1.13;
  }

  .eeum-hero-copy p {
    max-width: 640px;
    margin: 28px 0 0;
    color: var(--eeum-subtle) !important;
    font-size: 19px !important;
    line-height: 1.9 !important;
  }

  .eeum-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-top: 36px;
  }

  .eeum-button,
  .eeum-button-secondary {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 48px;
    border-radius: 999px;
    padding: 0 22px;
    font-weight: 800;
  }

  .eeum-button {
    background: linear-gradient(90deg, #7d4cf7, #9857ff);
    color: #fff !important;
  }

  .eeum-button-secondary {
    border: 1px solid var(--eeum-line);
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.74) !important;
  }

  .eeum-workspace-preview {
    display: grid;
    grid-template-columns: 184px minmax(0, 1fr);
    min-height: 520px;
    overflow: hidden;
    border: 1px solid var(--eeum-line);
    border-radius: 28px;
    background: #2f3035;
    box-shadow: 0 28px 90px rgba(5, 6, 10, 0.34);
  }

  .eeum-preview-sidebar {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 18px 14px;
    background: #292a2f;
    border-right: 1px solid var(--eeum-line);
  }

  .eeum-preview-brand {
    height: 24px;
    margin-bottom: 4px;
  }

  .eeum-mini-button {
    border-radius: 12px;
    padding: 11px 12px;
    background: linear-gradient(90deg, #7d4cf7, #9857ff);
    color: #fff;
    font-size: 13px;
    font-weight: 800;
  }

  .eeum-preview-label {
    color: rgba(255, 255, 255, 0.48);
    font-size: 12px;
    font-weight: 800;
  }

  .eeum-sidebar-card,
  .eeum-chat-item {
    border-radius: 12px;
    padding: 12px;
    background: rgba(255, 255, 255, 0.07);
  }

  .eeum-sidebar-card.active,
  .eeum-chat-item.active {
    background: rgba(128, 80, 255, 0.28);
    color: #cbaeff;
  }

  .eeum-sidebar-card strong,
  .eeum-chat-item strong {
    display: block;
    color: inherit;
    font-size: 12px;
  }

  .eeum-sidebar-card span,
  .eeum-chat-item span {
    display: block;
    margin-top: 4px;
    color: rgba(255, 255, 255, 0.42);
    font-size: 11px;
  }

  .eeum-preview-main {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    gap: 18px;
    padding: 18px;
  }

  .eeum-preview-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
  }

  .eeum-preview-header strong {
    color: #fff;
    font-size: 16px;
  }

  .eeum-tabs {
    display: flex;
    gap: 16px;
    color: rgba(255, 255, 255, 0.42);
    font-size: 13px;
    font-weight: 800;
  }

  .eeum-tabs span:first-child {
    color: #a977ff;
    box-shadow: inset 0 -2px 0 #8c5bff;
  }

  .eeum-chat-log {
    display: grid;
    align-content: start;
    gap: 18px;
  }

  .eeum-message {
    max-width: 78%;
    border-radius: 18px;
    padding: 16px;
    background: rgba(255, 255, 255, 0.1);
  }

  .eeum-message.user {
    justify-self: end;
    background: rgba(118, 74, 214, 0.55);
  }

  .eeum-message b {
    display: block;
    margin-bottom: 8px;
    color: #8c5cff;
    font-size: 13px;
  }

  .eeum-message p {
    margin: 0 !important;
    color: rgba(255, 255, 255, 0.78) !important;
    font-size: 14px !important;
    line-height: 1.75 !important;
  }

  .eeum-graph-strip {
    position: relative;
    height: 138px;
    overflow: hidden;
    border-radius: 18px;
    background:
      linear-gradient(rgba(255, 255, 255, 0.035) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 255, 255, 0.035) 1px, transparent 1px),
      #191a20;
    background-size: 32px 32px;
  }

  .eeum-node {
    position: absolute;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    padding: 8px 12px;
    background: rgba(124, 103, 255, 0.22);
    color: #fff;
    font-size: 12px;
    font-weight: 800;
    box-shadow: 0 0 28px rgba(124, 103, 255, 0.18);
  }

  .eeum-node.green {
    background: rgba(84, 212, 136, 0.22);
    color: #7debab;
  }

  .eeum-node.blue {
    background: rgba(120, 175, 245, 0.2);
    color: #78aff5;
  }

  .eeum-composer {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 44px;
    gap: 12px;
    align-items: center;
  }

  .eeum-composer span {
    border-radius: 999px;
    padding: 15px 18px;
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.42);
    font-size: 14px;
  }

  .eeum-composer i {
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    border-radius: 999px;
    background: linear-gradient(90deg, #7d4cf7, #9857ff);
    color: #fff;
    font-style: normal;
    font-weight: 900;
  }

  .eeum-section-header {
    max-width: 780px;
    margin-bottom: 32px;
  }

  .eeum-section-header h2 {
    margin: 14px 0 0;
    font-size: clamp(30px, 4vw, 46px);
    line-height: 1.25;
  }

  .eeum-section-header p {
    margin: 16px 0 0 !important;
    color: var(--eeum-subtle) !important;
  }

  .eeum-toc-grid,
  .eeum-feature-grid,
  .eeum-flow-grid,
  .eeum-stack-grid,
  .eeum-status-grid {
    display: grid;
    gap: 16px;
  }

  .eeum-toc-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .eeum-feature-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .eeum-flow-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .eeum-stack-grid {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }

  .eeum-status-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .eeum-card {
    border: 1px solid var(--eeum-line);
    border-radius: 20px;
    background: var(--eeum-card);
    padding: 22px;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
  }

  .eeum-card strong {
    display: block;
    color: #fff;
    font-size: 18px;
  }

  .eeum-card p,
  .eeum-card li {
    color: var(--eeum-muted) !important;
  }

  .eeum-card p {
    margin: 12px 0 0 !important;
  }

  .eeum-card ul {
    margin: 14px 0 0;
    padding-left: 18px;
  }

  .eeum-card.accent-purple {
    border-color: rgba(124, 103, 255, 0.42);
    background: linear-gradient(180deg, rgba(124, 103, 255, 0.16), rgba(255, 255, 255, 0.05));
  }

  .eeum-card.accent-green {
    border-color: rgba(122, 226, 165, 0.34);
  }

  .eeum-card.accent-blue {
    border-color: rgba(120, 175, 245, 0.34);
  }

  .eeum-toc-card {
    display: flex;
    align-items: center;
    gap: 14px;
    min-height: 74px;
  }

  .eeum-toc-number {
    display: grid;
    place-items: center;
    flex: 0 0 34px;
    width: 34px;
    height: 34px;
    border-radius: 999px;
    background: rgba(124, 103, 255, 0.22);
    color: #cbaeff;
    font-weight: 900;
  }

  .eeum-flow-step {
    position: relative;
    min-height: 220px;
  }

  .eeum-flow-step em {
    display: inline-flex;
    margin-bottom: 18px;
    border-radius: 999px;
    padding: 7px 12px;
    background: rgba(124, 103, 255, 0.16);
    color: #cbaeff;
    font-style: normal;
    font-size: 13px;
    font-weight: 900;
  }

  .eeum-stack-pill {
    display: grid;
    place-items: center;
    min-height: 70px;
    border: 1px solid var(--eeum-line);
    border-radius: 16px;
    background: rgba(255, 255, 255, 0.07);
    color: rgba(255, 255, 255, 0.78);
    font-weight: 800;
    text-align: center;
  }

  .eeum-architecture {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 12px;
    align-items: stretch;
  }

  .eeum-arch-box {
    display: grid;
    place-items: center;
    min-height: 94px;
    border: 1px solid var(--eeum-line);
    border-radius: 18px;
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.82);
    font-weight: 850;
    text-align: center;
  }

  .eeum-arch-box.highlight {
    border-color: rgba(124, 103, 255, 0.48);
    background: rgba(124, 103, 255, 0.16);
    color: #fff;
  }

  .eeum-code {
    overflow: auto;
    border: 1px solid var(--eeum-line);
    border-radius: 18px;
    background: #1c1d22;
    padding: 18px;
    color: #d8d7df;
    font-size: 14px;
    line-height: 1.7;
  }

  .eeum-note {
    border-left: 4px solid var(--eeum-purple);
    border-radius: 14px;
    background: rgba(124, 103, 255, 0.12);
    padding: 18px 20px;
  }

  .eeum-note p {
    margin: 0 !important;
  }

  @media (max-width: 980px) {
    .eeum-hero {
      grid-template-columns: 1fr;
      min-height: auto;
    }

    .eeum-workspace-preview {
      grid-template-columns: 160px minmax(0, 1fr);
      min-height: 480px;
    }

    .eeum-toc-grid,
    .eeum-feature-grid,
    .eeum-flow-grid,
    .eeum-stack-grid,
    .eeum-status-grid,
    .eeum-architecture {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 680px) {
    .eeum-section,
    .eeum-hero {
      padding-left: 18px;
      padding-right: 18px;
    }

    .eeum-workspace-preview {
      grid-template-columns: 1fr;
    }

    .eeum-preview-sidebar {
      display: none;
    }

    .eeum-toc-grid,
    .eeum-feature-grid,
    .eeum-flow-grid,
    .eeum-stack-grid,
    .eeum-status-grid,
    .eeum-architecture {
      grid-template-columns: 1fr;
    }

    .eeum-message {
      max-width: 100%;
    }
  }
</style>

<div class="eeum-page">
  <div class="eeum-hero" id="top">
    <div class="eeum-hero-copy">
      <div class="eeum-brand">
        <span class="eeum-logo" aria-hidden="true"></span>
        <span>eeum | 이음</span>
      </div>
      <span class="eeum-eyebrow">AI Tutor · Knowledge Graph · Personalized Learning</span>
      <h1>나에게 맞는 설명으로,<br/>배움을 그래프로 잇다</h1>
      <p>
        이음은 사용자의 현재 이해 수준을 진단하고, 프로젝트별 지식 그래프를 쌓아가며
        자료 기반 맞춤 설명을 제공하는 AI 튜터 서비스입니다.
      </p>
      <div class="eeum-actions">
        <a class="eeum-button" href="#service-flow">서비스 흐름 보기</a>
        <a class="eeum-button-secondary" href="#tech-stack">기술 스택 확인</a>
      </div>
    </div>

    <div class="eeum-workspace-preview" aria-label="이음 워크스페이스 미리보기">
      <div class="eeum-preview-sidebar">
        <span class="eeum-preview-brand eeum-logo" aria-hidden="true"></span>
        <span class="eeum-mini-button">+ 새 학습 시작</span>

        <span class="eeum-preview-label">프로젝트</span>
        <div class="eeum-sidebar-card active">
          <strong>운영체제 개념 정리</strong>
          <span>방금 업데이트</span>
        </div>
        <div class="eeum-sidebar-card">
          <strong>데이터베이스 프로젝트</strong>
          <span>2일 전</span>
        </div>

        <span class="eeum-preview-label">최근 채팅</span>
        <div class="eeum-chat-item active">
          <strong>스택과 큐 차이</strong>
          <span>이해도 기반 설명</span>
        </div>
        <div class="eeum-chat-item">
          <strong>프로세스 스케줄링</strong>
          <span>개념 관계 추출</span>
        </div>
      </div>

      <div class="eeum-preview-main">
        <div class="eeum-preview-header">
          <strong>운영체제 개념 정리</strong>
          <div class="eeum-tabs">
            <span>채팅</span>
            <span>그래프</span>
          </div>
        </div>

        <div class="eeum-chat-log">
          <div class="eeum-message">
            <b>이음 AI</b>
            <p>스택은 마지막에 들어온 데이터가 먼저 나오는 LIFO 구조입니다. 지금 수준에 맞춰 큐와 비교해서 설명할게요.</p>
          </div>
          <div class="eeum-message user">
            <p>그럼 큐와 반대라고 보면 되나요?</p>
          </div>
          <div class="eeum-graph-strip" aria-hidden="true">
            <span class="eeum-node" style="left: 42%; top: 44%;">Stack</span>
            <span class="eeum-node green" style="left: 12%; top: 22%;">LIFO</span>
            <span class="eeum-node blue" style="right: 12%; top: 26%;">Queue</span>
            <span class="eeum-node" style="left: 26%; bottom: 18%;">Deque</span>
          </div>
        </div>

        <div class="eeum-composer">
          <span>질문을 입력하세요.</span>
          <i>→</i>
        </div>
      </div>
    </div>
  </div>

  <div class="eeum-section" id="toc">
    <div class="eeum-section-header">
      <span class="eeum-eyebrow">Contents</span>
      <h2>목차</h2>
      <p>
        참조 문서의 큰 흐름은 유지하되, 이음 서비스에 맞게 소개, 기능, 학습 흐름,
        아키텍처, 실행 방법, 개발 현황 중심으로 재구성했습니다.
      </p>
    </div>
    <div class="eeum-toc-grid">
      <a class="eeum-card eeum-toc-card" href="#project-intro"><span class="eeum-toc-number">1</span><strong>프로젝트 소개</strong></a>
      <a class="eeum-card eeum-toc-card" href="#core-features"><span class="eeum-toc-number">2</span><strong>주요 기능</strong></a>
      <a class="eeum-card eeum-toc-card" href="#service-flow"><span class="eeum-toc-number">3</span><strong>서비스 흐름</strong></a>
      <a class="eeum-card eeum-toc-card" href="#screens"><span class="eeum-toc-number">4</span><strong>화면 구성</strong></a>
      <a class="eeum-card eeum-toc-card" href="#demo"><span class="eeum-toc-number">5</span><strong>소개 영상</strong></a>
      <a class="eeum-card eeum-toc-card" href="#architecture"><span class="eeum-toc-number">6</span><strong>시스템 구조</strong></a>
      <a class="eeum-card eeum-toc-card" href="#tech-stack"><span class="eeum-toc-number">7</span><strong>기술 스택</strong></a>
      <a class="eeum-card eeum-toc-card" href="#how-to-run"><span class="eeum-toc-number">8</span><strong>실행 방법</strong></a>
      <a class="eeum-card eeum-toc-card" href="#status"><span class="eeum-toc-number">9</span><strong>개발 현황</strong></a>
      <a class="eeum-card eeum-toc-card" href="#team"><span class="eeum-toc-number">10</span><strong>팀 소개</strong></a>
    </div>
  </div>

  <div class="eeum-section" id="project-intro">
    <div class="eeum-section-header">
      <span class="eeum-eyebrow">Project</span>
      <h2>프로젝트 소개</h2>
      <p>
        이음은 자료 업로드, 수준 진단, AI 설명, 지식 그래프를 하나의 학습 워크스페이스로 연결합니다.
      </p>
    </div>
    <div class="eeum-feature-grid">
      <div class="eeum-card accent-purple">
        <strong>자료 기반 학습</strong>
        <p>사용자가 프로젝트별로 학습 자료를 업로드하면 AI가 자료를 분석하고 핵심 개념을 학습 맥락으로 활용합니다.</p>
      </div>
      <div class="eeum-card accent-green">
        <strong>개인 수준 진단</strong>
        <p>최소 질문으로 현재 이해도를 확인하고, 부족 개념과 추천 학습 방향을 진단 결과로 정리합니다.</p>
      </div>
      <div class="eeum-card accent-blue">
        <strong>지식 그래프</strong>
        <p>채팅과 자료 분석에서 얻은 개념을 노드와 관계로 누적해 사용자의 학습 흐름을 시각화합니다.</p>
      </div>
    </div>
  </div>

  <div class="eeum-section" id="core-features">
    <div class="eeum-section-header">
      <span class="eeum-eyebrow">Features</span>
      <h2>주요 기능</h2>
    </div>
    <div class="eeum-feature-grid">
      <div class="eeum-card">
        <strong>자료 업로드</strong>
        <ul>
          <li>프로젝트 단위 PDF/TXT 자료 업로드</li>
          <li>분석 대기, 분석 중, 분석 완료 상태 표시</li>
          <li>분석 완료 후 진단 플로우로 이동</li>
        </ul>
      </div>
      <div class="eeum-card">
        <strong>학습 수준 진단</strong>
        <ul>
          <li>업로드 자료와 프로젝트 맥락 기반 문항 제공</li>
          <li>사용자 답변을 바탕으로 이해도 평가</li>
          <li>부족 개념과 추천 학습 경로 도출</li>
        </ul>
      </div>
      <div class="eeum-card">
        <strong>맞춤 AI 채팅</strong>
        <ul>
          <li>사용자 수준에 맞춘 설명 난이도 조절</li>
          <li>프로젝트별 최근 채팅 관리</li>
          <li>대화에서 핵심 개념과 관계 추출</li>
        </ul>
      </div>
      <div class="eeum-card">
        <strong>프로젝트 워크스페이스</strong>
        <ul>
          <li>프로젝트 생성과 전환</li>
          <li>프로젝트별 채팅 목록 관리</li>
          <li>자료, 메모, 그래프를 한 화면에서 확인</li>
        </ul>
      </div>
      <div class="eeum-card">
        <strong>지식 그래프 탐색</strong>
        <ul>
          <li>개념 노드와 관계 엣지 시각화</li>
          <li>노드 검색, 선택, 이동, 확대/축소</li>
          <li>프로젝트별 그래프와 통합 그래프 확장 가능</li>
        </ul>
      </div>
      <div class="eeum-card">
        <strong>마이페이지</strong>
        <ul>
          <li>프로필과 학습 통계 표시</li>
          <li>최근 학습 기록 확인</li>
          <li>사용자 전체 지식 그래프 확인</li>
        </ul>
      </div>
    </div>
  </div>

  <div class="eeum-section" id="service-flow">
    <div class="eeum-section-header">
      <span class="eeum-eyebrow">Flow</span>
      <h2>서비스 흐름</h2>
      <p>이음의 기본 사용 흐름은 자료를 올리고, 현재 수준을 확인한 뒤, 맞춤 설명과 그래프로 학습을 이어가는 방식입니다.</p>
    </div>
    <div class="eeum-flow-grid">
      <div class="eeum-card eeum-flow-step">
        <em>Step 01</em>
        <strong>자료 업로드</strong>
        <p>프로젝트를 만들고 학습 자료를 업로드합니다. 자료는 이후 진단과 채팅의 기반 맥락이 됩니다.</p>
      </div>
      <div class="eeum-card eeum-flow-step">
        <em>Step 02</em>
        <strong>학습 상태 진단</strong>
        <p>AI가 몇 가지 질문으로 현재 이해도를 파악하고 부족한 개념을 정리합니다.</p>
      </div>
      <div class="eeum-card eeum-flow-step">
        <em>Step 03</em>
        <strong>맞춤 설명</strong>
        <p>진단 결과와 자료 내용을 바탕으로 사용자에게 맞는 난이도의 설명을 제공합니다.</p>
      </div>
      <div class="eeum-card eeum-flow-step">
        <em>Step 04</em>
        <strong>그래프로 누적</strong>
        <p>새로 학습한 개념과 관계가 프로젝트별 지식 그래프에 쌓이고 다음 학습 경로를 보여줍니다.</p>
      </div>
    </div>
  </div>

  <div class="eeum-section" id="screens">
    <div class="eeum-section-header">
      <span class="eeum-eyebrow">Screens</span>
      <h2>화면 구성</h2>
    </div>
    <div class="eeum-status-grid">
      <div class="eeum-card">
        <strong>랜딩 페이지</strong>
        <p>서비스의 핵심 메시지, 주요 기능, 이용 방법을 소개합니다. 보라색 CTA와 그래프 배경을 중심으로 브랜드 분위기를 전달합니다.</p>
      </div>
      <div class="eeum-card">
        <strong>대시보드</strong>
        <p>좌측 프로젝트/최근 채팅 패널, 중앙 채팅/그래프 탭, 우측 자료 패널로 구성된 학습 워크스페이스입니다.</p>
      </div>
      <div class="eeum-card">
        <strong>업로드</strong>
        <p>프로젝트별 자료 업로드와 분석 상태를 관리합니다. 분석 완료 후 진단 화면으로 자연스럽게 이어집니다.</p>
      </div>
      <div class="eeum-card">
        <strong>진단 및 마이페이지</strong>
        <p>개인 수준 진단 결과와 학습 통계, 최근 학습 기록, 전체 지식 그래프를 확인합니다.</p>
      </div>
    </div>
  </div>

  <div class="eeum-section" id="demo">
    <div class="eeum-section-header">
      <span class="eeum-eyebrow">Demo</span>
      <h2>소개 영상</h2>
      <p>서비스 시연 영상 또는 배포 링크가 확정되면 이 영역에 삽입할 수 있습니다.</p>
    </div>
    <div class="eeum-card accent-purple">
      <strong>데모 준비 중</strong>
      <p>
        현재 페이지에는 이음의 주요 화면과 기능 흐름을 먼저 정리했습니다.
        최종 시연 영상이 준비되면 YouTube, Google Drive, 또는 배포 서비스 링크를 이 섹션에 연결하면 됩니다.
      </p>
    </div>
  </div>

  <div class="eeum-section" id="architecture">
    <div class="eeum-section-header">
      <span class="eeum-eyebrow">Architecture</span>
      <h2>시스템 구조</h2>
      <p>현재 프론트엔드는 mock/localStorage 기반으로 동작하며, 최종 서비스는 AWS 기반 백엔드와 연동하는 방향으로 설계했습니다.</p>
    </div>
    <div class="eeum-architecture">
      <div class="eeum-arch-box highlight">Next.js<br/>Frontend</div>
      <div class="eeum-arch-box">EC2<br/>Backend API</div>
      <div class="eeum-arch-box">RDS<br/>PostgreSQL</div>
      <div class="eeum-arch-box">S3 + Lambda<br/>File Analysis</div>
      <div class="eeum-arch-box highlight">Amazon<br/>Bedrock</div>
    </div>
    <div class="eeum-note" style="margin-top: 20px;">
      <p>
        EC2 백엔드는 인증, DB 접근, S3 presigned URL 발급, Bedrock 호출 orchestration을 담당하고,
        Lambda는 업로드된 자료의 비동기 분석과 개념/관계 추출을 담당하는 구조를 목표로 합니다.
      </p>
    </div>
  </div>

  <div class="eeum-section" id="tech-stack">
    <div class="eeum-section-header">
      <span class="eeum-eyebrow">Tech Stack</span>
      <h2>기술 스택</h2>
    </div>
    <div class="eeum-stack-grid">
      <span class="eeum-stack-pill">Next.js 15</span>
      <span class="eeum-stack-pill">React 19</span>
      <span class="eeum-stack-pill">Tailwind CSS</span>
      <span class="eeum-stack-pill">TypeScript</span>
      <span class="eeum-stack-pill">Zustand</span>
      <span class="eeum-stack-pill">Framer Motion</span>
      <span class="eeum-stack-pill">Font Awesome</span>
      <span class="eeum-stack-pill">FastAPI</span>
      <span class="eeum-stack-pill">AWS S3</span>
      <span class="eeum-stack-pill">Amazon Bedrock</span>
    </div>
  </div>

  <div class="eeum-section" id="how-to-run">
    <div class="eeum-section-header">
      <span class="eeum-eyebrow">Run</span>
      <h2>실행 방법</h2>
    </div>
    <div class="eeum-status-grid">
      <div class="eeum-card">
        <strong>프론트엔드 실행</strong>
        <pre class="eeum-code"><code>cd frontend
npm install
npm run dev</code></pre>
      </div>
      <div class="eeum-card">
        <strong>프로덕션 빌드 확인</strong>
        <pre class="eeum-code"><code>cd frontend
npm run build
npm run start</code></pre>
      </div>
      <div class="eeum-card">
        <strong>백엔드 API 환경 변수</strong>
        <pre class="eeum-code"><code>NEXT_PUBLIC_USE_BACKEND_API=true
NEXT_PUBLIC_API_BASE_URL=/api/backend
BACKEND_API_URL=http://localhost:8000</code></pre>
      </div>
      <div class="eeum-card">
        <strong>백엔드 실행 예시</strong>
        <pre class="eeum-code"><code>cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000</code></pre>
      </div>
    </div>
  </div>

  <div class="eeum-section" id="status">
    <div class="eeum-section-header">
      <span class="eeum-eyebrow">Status</span>
      <h2>개발 현황 및 계획</h2>
    </div>
    <div class="eeum-status-grid">
      <div class="eeum-card accent-green">
        <strong>현재 구현</strong>
        <ul>
          <li>랜딩, 로그인 UI, 대시보드, 업로드, 진단, 프로젝트 워크스페이스, 마이페이지 화면</li>
          <li>localStorage/mock 기반 프로젝트, 채팅, 업로드, 그래프 데이터 흐름</li>
          <li>프로젝트별 지식 그래프 인터랙션</li>
        </ul>
      </div>
      <div class="eeum-card accent-purple">
        <strong>추후 구현</strong>
        <ul>
          <li>인증/session 및 사용자 프로필 DB 연동</li>
          <li>프로젝트, 채팅, 메시지, 지식 그래프 API 연동</li>
          <li>S3 파일 업로드, Lambda 자료 분석, Bedrock 기반 AI 응답 연결</li>
        </ul>
      </div>
    </div>
  </div>

  <div class="eeum-section" id="team">
    <div class="eeum-section-header">
      <span class="eeum-eyebrow">Team</span>
      <h2>팀 소개</h2>
      <p>팀원별 담당 영역은 최종 제출 정보에 맞춰 업데이트할 수 있도록 카드 형태로 남겨두었습니다.</p>
    </div>
    <div class="eeum-feature-grid">
      <div class="eeum-card">
        <strong>Frontend</strong>
        <p>Next.js 기반 랜딩, 대시보드, 업로드, 진단, 마이페이지 UI 및 사용자 흐름 구현</p>
      </div>
      <div class="eeum-card">
        <strong>Backend / AI</strong>
        <p>FastAPI, DB, Bedrock 연동, 자료 분석, 맞춤 설명, 진단 평가 API 설계 및 구현</p>
      </div>
      <div class="eeum-card">
        <strong>Cloud / Infra</strong>
        <p>EC2, S3, Lambda, RDS, 배포 환경 구성 및 운영 보안 정책 설계</p>
      </div>
    </div>
  </div>
</div>
