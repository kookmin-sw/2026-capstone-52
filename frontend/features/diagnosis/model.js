export const diagnosisStatusMap = {
  understood: { label: "이해", tone: "understood" },
  needsReview: { label: "추가 학습 필요", tone: "needs-review" },
  inProgress: { label: "진행 중", tone: "in-progress" },
  unknown: { label: "미진단", tone: "unknown" },
};

const diagnosisTemplates = {
  calculus: {
    concepts: ["기울기", "변화율", "미분계수", "접선", "직선의 방정식"],
    questions: [
      {
        id: "calculus-q1",
        type: "multiple-choice",
        conceptIds: ["기울기", "변화율"],
        prompt: "다음 중 기울기를 가장 잘 설명하는 것은 무엇인가요?",
        choices: [
          { id: "a", label: "두 점 사이 변화량의 비율이다." },
          { id: "b", label: "곡선의 넓이를 나타내는 값이다." },
          { id: "c", label: "항상 0보다 큰 상수다." },
          { id: "unknown", label: "잘 모르겠어요." },
        ],
        correctChoiceId: "a",
      },
      {
        id: "calculus-q2",
        type: "short-answer",
        conceptIds: ["접선", "미분계수"],
        prompt: "접선의 기울기와 미분계수가 왜 연결되는지 한두 문장으로 설명해보세요.",
        placeholder: "예: 특정 점에서의 순간 변화율을 나타내기 때문에...",
        expectedKeywords: ["순간", "변화율", "특정 점"],
      },
      {
        id: "calculus-q3",
        type: "multiple-choice",
        conceptIds: ["직선의 방정식", "접선"],
        prompt: "접선의 방정식을 세울 때 꼭 필요한 정보 조합은 무엇인가요?",
        choices: [
          { id: "a", label: "지나는 점 하나와 그 점에서의 기울기" },
          { id: "b", label: "그래프의 전체 넓이와 기울기" },
          { id: "c", label: "함수값 두 개만 알면 된다" },
          { id: "unknown", label: "잘 모르겠어요." },
        ],
        correctChoiceId: "a",
      },
    ],
  },
  os: {
    concepts: ["FCFS", "Round Robin", "우선순위 스케줄링", "기아 현상", "에이징 기법"],
    questions: [
      {
        id: "os-q1",
        type: "multiple-choice",
        conceptIds: ["우선순위 스케줄링", "기아 현상"],
        prompt: "다음 중 CPU 스케줄링에서 '기아 현상(Starvation)'이 발생할 수 있는 것은?",
        choices: [
          { id: "a", label: "FCFS" },
          { id: "b", label: "Round Robin" },
          { id: "c", label: "우선순위 스케줄링" },
          { id: "d", label: "SJF가 항상 기아 현상을 막는다" },
          { id: "unknown", label: "잘 모르겠어요." },
        ],
        correctChoiceId: "c",
      },
      {
        id: "os-q2",
        type: "short-answer",
        conceptIds: ["기아 현상", "에이징 기법"],
        prompt: "기아 현상을 줄이기 위해 에이징 기법을 왜 사용하는지 설명해보세요.",
        placeholder: "예: 오래 기다린 프로세스의 우선순위를 점진적으로 높여서...",
        expectedKeywords: ["오래", "우선순위", "높", "기다"],
      },
      {
        id: "os-q3",
        type: "multiple-choice",
        conceptIds: ["FCFS", "Round Robin"],
        prompt: "Round Robin이 FCFS보다 응답성을 개선하는 가장 큰 이유는 무엇인가요?",
        choices: [
          { id: "a", label: "프로세스마다 시간 할당량을 나눠 돌아가며 실행하기 때문이다." },
          { id: "b", label: "항상 가장 짧은 작업만 먼저 실행하기 때문이다." },
          { id: "c", label: "우선순위가 낮은 작업을 제거하기 때문이다." },
          { id: "unknown", label: "잘 모르겠어요." },
        ],
        correctChoiceId: "a",
      },
    ],
  },
  ml: {
    concepts: ["선형대수", "미분", "손실 함수", "경사하강법", "과적합"],
    questions: [
      {
        id: "ml-q1",
        type: "multiple-choice",
        conceptIds: ["손실 함수", "경사하강법"],
        prompt: "경사하강법에서 손실 함수 값이 하는 역할은 무엇인가요?",
        choices: [
          { id: "a", label: "모델이 얼마나 틀렸는지 측정하는 기준이다." },
          { id: "b", label: "데이터 개수를 세는 값이다." },
          { id: "c", label: "항상 0으로 고정되는 값이다." },
          { id: "unknown", label: "잘 모르겠어요." },
        ],
        correctChoiceId: "a",
      },
      {
        id: "ml-q2",
        type: "short-answer",
        conceptIds: ["미분", "경사하강법"],
        prompt: "경사하강법에서 미분값을 보는 이유를 짧게 설명해보세요.",
        placeholder: "예: 어느 방향으로 가면 손실이 줄어드는지 알 수 있어서...",
        expectedKeywords: ["방향", "줄", "기울기", "손실"],
      },
      {
        id: "ml-q3",
        type: "multiple-choice",
        conceptIds: ["과적합", "손실 함수"],
        prompt: "과적합을 의심해야 하는 상황은 무엇인가요?",
        choices: [
          { id: "a", label: "훈련 성능은 매우 높지만 검증 성능이 낮을 때" },
          { id: "b", label: "훈련과 검증 성능이 모두 낮을 때만" },
          { id: "c", label: "데이터가 많을수록 항상 발생하지 않는다" },
          { id: "unknown", label: "잘 모르겠어요." },
        ],
        correctChoiceId: "a",
      },
    ],
  },
  db: {
    concepts: ["정규화", "조인", "인덱스", "트랜잭션", "격리 수준"],
    questions: [
      {
        id: "db-q1",
        type: "multiple-choice",
        conceptIds: ["인덱스", "조인"],
        prompt: "인덱스를 사용하는 가장 큰 이유는 무엇인가요?",
        choices: [
          { id: "a", label: "검색 속도를 높이기 위해서" },
          { id: "b", label: "테이블 개수를 줄이기 위해서" },
          { id: "c", label: "모든 중복 데이터를 자동 제거하기 위해서" },
          { id: "unknown", label: "잘 모르겠어요." },
        ],
        correctChoiceId: "a",
      },
      {
        id: "db-q2",
        type: "short-answer",
        conceptIds: ["트랜잭션", "격리 수준"],
        prompt: "트랜잭션에서 격리 수준이 필요한 이유를 설명해보세요.",
        placeholder: "예: 여러 요청이 동시에 데이터를 바꿀 때 충돌이나 이상 현상을 줄이기 위해...",
        expectedKeywords: ["동시", "충돌", "이상", "일관성"],
      },
      {
        id: "db-q3",
        type: "multiple-choice",
        conceptIds: ["정규화", "조인"],
        prompt: "정규화를 수행하는 주된 목적은 무엇인가요?",
        choices: [
          { id: "a", label: "중복을 줄이고 데이터 이상을 방지하기 위해" },
          { id: "b", label: "모든 조회를 단일 테이블로 만들기 위해" },
          { id: "c", label: "조인을 없애기 위해" },
          { id: "unknown", label: "잘 모르겠어요." },
        ],
        correctChoiceId: "a",
      },
    ],
  },
  network: {
    concepts: ["OSI 7계층", "TCP", "UDP", "라우팅", "흐름 제어"],
    questions: [
      {
        id: "network-q1",
        type: "multiple-choice",
        conceptIds: ["TCP", "UDP"],
        prompt: "TCP가 UDP보다 신뢰성이 높다고 말하는 이유로 가장 적절한 것은?",
        choices: [
          { id: "a", label: "순서 보장과 재전송 제어를 수행하기 때문이다." },
          { id: "b", label: "항상 더 빠르기 때문이다." },
          { id: "c", label: "헤더가 더 작기 때문이다." },
          { id: "unknown", label: "잘 모르겠어요." },
        ],
        correctChoiceId: "a",
      },
      {
        id: "network-q2",
        type: "short-answer",
        conceptIds: ["OSI 7계층", "라우팅"],
        prompt: "라우팅이 네트워크 계층에서 다뤄지는 이유를 짧게 설명해보세요.",
        placeholder: "예: 목적지까지 패킷 경로를 결정해야 해서...",
        expectedKeywords: ["경로", "패킷", "목적지"],
      },
      {
        id: "network-q3",
        type: "multiple-choice",
        conceptIds: ["TCP", "흐름 제어"],
        prompt: "흐름 제어의 목적은 무엇인가요?",
        choices: [
          { id: "a", label: "송신자가 수신자의 처리 속도를 넘지 않도록 맞추기 위해" },
          { id: "b", label: "패킷을 암호화하기 위해" },
          { id: "c", label: "라우터 개수를 줄이기 위해" },
          { id: "unknown", label: "잘 모르겠어요." },
        ],
        correctChoiceId: "a",
      },
    ],
  },
};

function slugifyConcept(label) {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function createFallbackTemplate(projectData) {
  const concepts = (projectData.graphNodes || []).slice(0, 5);
  const normalizedConcepts = concepts.length ? concepts : ["핵심 개념", "기초 개념", "응용 개념"];

  return {
    concepts: normalizedConcepts,
    questions: [
      {
        id: `${projectData.projectId}-q1`,
        type: "multiple-choice",
        conceptIds: [normalizedConcepts[0], normalizedConcepts[1] || normalizedConcepts[0]],
        prompt: `${projectData.title}에서 가장 기본이 되는 개념을 어느 정도 알고 있나요?`,
        choices: [
          { id: "a", label: "핵심 정의와 예시는 설명할 수 있어요." },
          { id: "b", label: "이름은 아는데 설명은 아직 어려워요." },
          { id: "c", label: "거의 처음 보는 수준이에요." },
          { id: "unknown", label: "잘 모르겠어요." },
        ],
        correctChoiceId: "a",
      },
      {
        id: `${projectData.projectId}-q2`,
        type: "short-answer",
        conceptIds: [normalizedConcepts[1] || normalizedConcepts[0], normalizedConcepts[2] || normalizedConcepts[0]],
        prompt: `지금 가장 헷갈리는 개념이나 연결 관계를 자유롭게 설명해보세요.`,
        placeholder: "예: 정의는 아는데 실제 문제에서 언제 써야 하는지 헷갈립니다.",
        expectedKeywords: ["정의", "예시", "문제", "적용"],
      },
      {
        id: `${projectData.projectId}-q3`,
        type: "multiple-choice",
        conceptIds: [normalizedConcepts[2] || normalizedConcepts[0], normalizedConcepts[0]],
        prompt: "다음 중 현재 본인 상태에 가장 가까운 것은 무엇인가요?",
        choices: [
          { id: "a", label: "기초 개념은 이해했고 응용 연결을 점검하면 돼요." },
          { id: "b", label: "기초부터 차근차근 다시 정리하고 싶어요." },
          { id: "c", label: "문제 풀이 경험은 있지만 설명은 불안정해요." },
          { id: "unknown", label: "잘 모르겠어요." },
        ],
        correctChoiceId: "a",
      },
    ],
  };
}

function getTemplate(projectData) {
  return diagnosisTemplates[projectData.projectId] || createFallbackTemplate(projectData);
}

export function createDiagnosisSession(projectData) {
  const template = getTemplate(projectData);
  const concepts = template.concepts.map((label) => ({
    id: slugifyConcept(label),
    label,
  }));

  return {
    id: `${projectData.projectId}-diagnosis-session`,
    projectId: projectData.projectId,
    projectTitle: projectData.title,
    totalQuestions: template.questions.length,
    estimatedMinutes: 2,
    concepts,
    questions: template.questions.map((question, index) => ({
      ...question,
      order: index + 1,
      conceptIds: question.conceptIds.map((label) => slugifyConcept(label)),
    })),
  };
}

export function createEmptyAnswers(session) {
  return session.questions.reduce((result, question) => {
    result[question.id] = "";
    return result;
  }, {});
}

function normalizeText(value) {
  return value.trim().toLowerCase();
}

export function isAnswerReady(question, answer) {
  if (!question) {
    return false;
  }

  if (question.type === "short-answer") {
    return answer.trim().length >= 2;
  }

  return Boolean(answer);
}

export function evaluateQuestion(question, answer) {
  if (question.type === "multiple-choice") {
    return {
      correct: answer === question.correctChoiceId,
      confidence: answer === question.correctChoiceId ? 1 : 0,
    };
  }

  const normalized = normalizeText(answer);

  if (!normalized) {
    return { correct: false, confidence: 0 };
  }

  const keywordMatches = (question.expectedKeywords || []).filter((keyword) => normalized.includes(keyword.toLowerCase())).length;
  const threshold = Math.max(1, Math.ceil((question.expectedKeywords || []).length / 2));

  return {
    correct: keywordMatches >= threshold,
    confidence: question.expectedKeywords?.length ? keywordMatches / question.expectedKeywords.length : 0,
  };
}

export function buildConceptStatuses(session, answers, currentQuestionIndex = 0, isComplete = false) {
  const statuses = new Map(
    session.concepts.map((concept) => [
      concept.id,
      {
        ...concept,
        status: diagnosisStatusMap.unknown.label,
        tone: diagnosisStatusMap.unknown.tone,
      },
    ])
  );

  session.questions.forEach((question, index) => {
    const answer = answers[question.id];
    const hasAnswer = typeof answer === "string" && answer.trim().length > 0;

    if (!hasAnswer && !isComplete && index === currentQuestionIndex) {
      question.conceptIds.forEach((conceptId) => {
        const concept = statuses.get(conceptId);

        if (concept && concept.tone === diagnosisStatusMap.unknown.tone) {
          statuses.set(conceptId, {
            ...concept,
            status: diagnosisStatusMap.inProgress.label,
            tone: diagnosisStatusMap.inProgress.tone,
          });
        }
      });

      return;
    }

    if (!hasAnswer) {
      return;
    }

    const evaluation = evaluateQuestion(question, answer);
    const nextStatus = evaluation.correct ? diagnosisStatusMap.understood : diagnosisStatusMap.needsReview;

    question.conceptIds.forEach((conceptId) => {
      const concept = statuses.get(conceptId);

      if (!concept) {
        return;
      }

      statuses.set(conceptId, {
        ...concept,
        status: nextStatus.label,
        tone: nextStatus.tone,
      });
    });
  });

  return [...statuses.values()];
}

export function buildDiagnosisAssessment(session, answers) {
  const conceptStatuses = buildConceptStatuses(session, answers, session.questions.length, true);
  const understood = conceptStatuses.filter((concept) => concept.tone === diagnosisStatusMap.understood.tone);
  const needsReview = conceptStatuses.filter((concept) => concept.tone === diagnosisStatusMap.needsReview.tone);

  let levelTitle = "현재 수준: 개념 기초부터 보강 필요";
  let summary = `${session.projectTitle} 기준으로 보면 개념의 정의와 연결 구조를 먼저 안정적으로 정리하는 단계가 적절합니다.`;

  if (understood.length >= 3 && needsReview.length <= 1) {
    levelTitle = "현재 수준: 핵심 개념 이해";
    summary = `${session.projectTitle}의 핵심 개념은 전반적으로 이해하고 있습니다. 이후 대화에서는 응용 연결과 약한 개념 보강 중심으로 설명을 조정하면 됩니다.`;
  } else if (understood.length >= 2) {
    levelTitle = "현재 수준: 핵심 개념 일부 이해";
    summary = `${session.projectTitle}의 기초 개념은 일부 이해하고 있지만, 연결이 약한 개념은 추가 설명이 필요한 상태입니다.`;
  }

  const missingConcepts = needsReview.map((concept) => concept.label);
  const roadmap = missingConcepts.length
    ? [
        ...missingConcepts.map((concept) => `${concept} 개념 다시 정리`),
        "예시 기반 설명으로 개념 연결 복습",
        "짧은 확인 질문으로 이해 여부 재점검",
      ]
    : ["응용 문제 중심으로 설명 확장", "복합 개념 연결 질문으로 난이도 상향"];

  return {
    levelTitle,
    summary,
    missingConcepts,
    roadmap,
    conceptStatuses,
  };
}
