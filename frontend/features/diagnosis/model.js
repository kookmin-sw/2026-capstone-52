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
        type: "multiple-choice",
        conceptIds: ["접선", "미분계수"],
        prompt: "접선의 기울기와 미분계수가 연결되는 이유로 가장 적절한 것은?",
        choices: [
          { id: "a", label: "특정 점에서의 순간 변화율을 나타내기 때문이다." },
          { id: "b", label: "곡선 아래 넓이를 직접 계산하기 때문이다." },
          { id: "c", label: "항상 두 점 사이 평균 변화율만 사용하기 때문이다." },
          { id: "unknown", label: "잘 모르겠어요." },
        ],
        correctChoiceId: "a",
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
    concepts: [
      "프로세스",
      "스레드",
      "문맥 교환",
      "FCFS",
      "SJF",
      "Round Robin",
      "우선순위 스케줄링",
      "기아 현상",
      "에이징 기법",
      "교착 상태",
      "가상 메모리",
      "페이지 교체",
      "캐시",
      "파일 시스템",
      "시스템 콜",
      "인터럽트",
    ],
    questions: [
      {
        id: "os-q1",
        type: "multiple-choice",
        conceptIds: ["프로세스", "스레드"],
        prompt: "프로세스와 스레드에 대한 설명으로 옳은 것을 모두 고르세요.",
        choices: [
          { id: "a", label: "프로세스는 독립된 주소 공간을 가진다." },
          { id: "b", label: "스레드는 같은 프로세스 내의 자원을 공유할 수 있다." },
          { id: "c", label: "스레드는 항상 프로세스보다 생성 비용이 크다." },
          { id: "d", label: "하나의 프로세스는 여러 개의 스레드를 가질 수 있다." },
          { id: "unknown", label: "잘 모르겠어요." },
        ],
        correctChoiceIds: ["a", "b", "d"],
      },
      {
        id: "os-q2",
        type: "multiple-choice",
        conceptIds: ["문맥 교환", "프로세스"],
        prompt: "문맥 교환(Context Switching)에 대한 설명으로 옳은 것을 모두 고르세요.",
        choices: [
          { id: "a", label: "CPU가 실행할 프로세스나 스레드를 바꿀 때 발생한다." },
          { id: "b", label: "현재 실행 상태를 저장하고 다음 실행 상태를 복원한다." },
          { id: "c", label: "문맥 교환은 오버헤드를 발생시킬 수 있다." },
          { id: "d", label: "문맥 교환이 많아질수록 항상 성능이 향상된다." },
          { id: "unknown", label: "잘 모르겠어요." },
        ],
        correctChoiceIds: ["a", "b", "c"],
      },
      {
        id: "os-q3",
        type: "multiple-choice",
        conceptIds: ["FCFS", "CPU 스케줄링"],
        prompt: "FCFS 스케줄링에 대한 설명으로 옳은 것을 모두 고르세요.",
        choices: [
          { id: "a", label: "먼저 도착한 프로세스를 먼저 실행한다." },
          { id: "b", label: "구현이 비교적 단순하다." },
          { id: "c", label: "짧은 작업이 긴 작업 뒤에서 오래 기다릴 수 있다." },
          { id: "d", label: "항상 평균 대기 시간이 가장 짧다." },
          { id: "unknown", label: "잘 모르겠어요." },
        ],
        correctChoiceIds: ["a", "b", "c"],
      },
      {
        id: "os-q4",
        type: "multiple-choice",
        conceptIds: ["SJF", "기아 현상"],
        prompt: "SJF 스케줄링에 대한 설명으로 옳은 것을 모두 고르세요.",
        choices: [
          { id: "a", label: "실행 시간이 짧은 작업을 먼저 실행한다." },
          { id: "b", label: "평균 대기 시간을 줄이는 데 유리할 수 있다." },
          { id: "c", label: "긴 작업이 계속 뒤로 밀리는 기아 현상이 발생할 수 있다." },
          { id: "d", label: "도착 순서만 기준으로 스케줄링한다." },
          { id: "unknown", label: "잘 모르겠어요." },
        ],
        correctChoiceIds: ["a", "b", "c"],
      },
      {
        id: "os-q5",
        type: "multiple-choice",
        conceptIds: ["Round Robin", "문맥 교환"],
        prompt: "Round Robin 스케줄링에 대한 설명으로 옳은 것을 모두 고르세요.",
        choices: [
          { id: "a", label: "각 프로세스에 시간 할당량을 부여한다." },
          { id: "b", label: "대화형 시스템에서 응답성을 개선하는 데 유리하다." },
          { id: "c", label: "시간 할당량이 너무 작으면 문맥 교환 오버헤드가 커질 수 있다." },
          { id: "d", label: "항상 가장 높은 우선순위의 프로세스만 실행한다." },
          { id: "unknown", label: "잘 모르겠어요." },
        ],
        correctChoiceIds: ["a", "b", "c"],
      },
      {
        id: "os-q6",
        type: "multiple-choice",
        conceptIds: ["우선순위 스케줄링", "기아 현상", "에이징 기법"],
        prompt: "우선순위 스케줄링에 대한 설명으로 옳은 것을 모두 고르세요.",
        choices: [
          { id: "a", label: "우선순위가 높은 프로세스를 먼저 실행할 수 있다." },
          { id: "b", label: "낮은 우선순위의 프로세스가 오래 기다리는 기아 현상이 발생할 수 있다." },
          { id: "c", label: "에이징 기법은 오래 기다린 프로세스의 우선순위를 높이는 방식이다." },
          { id: "d", label: "우선순위 스케줄링에서는 기아 현상이 절대 발생하지 않는다." },
          { id: "unknown", label: "잘 모르겠어요." },
        ],
        correctChoiceIds: ["a", "b", "c"],
      },
      {
        id: "os-q7",
        type: "multiple-choice",
        conceptIds: ["교착 상태"],
        prompt: "교착 상태(Deadlock)에 대한 설명으로 옳은 것을 모두 고르세요.",
        choices: [
          { id: "a", label: "여러 프로세스가 서로가 가진 자원을 기다리며 진행하지 못하는 상태이다." },
          { id: "b", label: "상호 배제, 점유와 대기, 비선점, 순환 대기 조건과 관련이 있다." },
          { id: "c", label: "교착 상태가 발생하면 프로세스들이 계속 정상적으로 실행된다." },
          { id: "d", label: "자원 할당 순서를 제한하면 교착 상태 예방에 도움이 될 수 있다." },
          { id: "unknown", label: "잘 모르겠어요." },
        ],
        correctChoiceIds: ["a", "b", "d"],
      },
      {
        id: "os-q8",
        type: "multiple-choice",
        conceptIds: ["교착 상태", "상호 배제"],
        prompt: "교착 상태 발생 조건에 대한 설명으로 옳은 것을 모두 고르세요.",
        choices: [
          { id: "a", label: "상호 배제는 하나의 자원을 한 번에 하나의 프로세스만 사용할 수 있음을 의미한다." },
          { id: "b", label: "점유와 대기는 자원을 가진 프로세스가 다른 자원을 추가로 기다리는 상황이다." },
          { id: "c", label: "순환 대기는 프로세스들이 원형으로 서로의 자원을 기다리는 상황이다." },
          { id: "d", label: "비선점은 운영체제가 언제든지 강제로 모든 자원을 빼앗을 수 있음을 의미한다." },
          { id: "unknown", label: "잘 모르겠어요." },
        ],
        correctChoiceIds: ["a", "b", "c"],
      },
      {
        id: "os-q9",
        type: "multiple-choice",
        conceptIds: ["가상 메모리", "페이지"],
        prompt: "가상 메모리에 대한 설명으로 옳은 것을 모두 고르세요.",
        choices: [
          { id: "a", label: "프로세스가 물리 메모리보다 큰 논리 주소 공간을 사용할 수 있게 한다." },
          { id: "b", label: "필요한 페이지를 메모리에 올리는 방식과 관련이 있다." },
          { id: "c", label: "가상 메모리를 사용하면 페이지 폴트가 절대 발생하지 않는다." },
          { id: "d", label: "메모리 관리의 유연성을 높일 수 있다." },
          { id: "unknown", label: "잘 모르겠어요." },
        ],
        correctChoiceIds: ["a", "b", "d"],
      },
      {
        id: "os-q10",
        type: "multiple-choice",
        conceptIds: ["페이지 교체", "페이지 폴트"],
        prompt: "페이지 폴트와 페이지 교체에 대한 설명으로 옳은 것을 모두 고르세요.",
        choices: [
          { id: "a", label: "페이지 폴트는 필요한 페이지가 메모리에 없을 때 발생한다." },
          { id: "b", label: "메모리가 부족하면 기존 페이지를 내보내고 새 페이지를 가져올 수 있다." },
          { id: "c", label: "페이지 교체 알고리즘에는 FIFO, LRU 등이 있다." },
          { id: "d", label: "페이지 폴트는 CPU의 산술 연산 장치가 고장났다는 뜻이다." },
          { id: "unknown", label: "잘 모르겠어요." },
        ],
        correctChoiceIds: ["a", "b", "c"],
      },
      {
        id: "os-q11",
        type: "multiple-choice",
        conceptIds: ["캐시", "지역성"],
        prompt: "캐시 메모리와 지역성에 대한 설명으로 옳은 것을 모두 고르세요.",
        choices: [
          { id: "a", label: "시간 지역성은 최근 사용한 데이터가 다시 사용될 가능성이 높다는 성질이다." },
          { id: "b", label: "공간 지역성은 사용한 데이터 근처의 데이터가 사용될 가능성이 높다는 성질이다." },
          { id: "c", label: "캐시는 CPU와 메모리 사이의 속도 차이를 줄이는 데 도움을 준다." },
          { id: "d", label: "캐시는 항상 주기억장치보다 용량이 크다." },
          { id: "unknown", label: "잘 모르겠어요." },
        ],
        correctChoiceIds: ["a", "b", "c"],
      },
      {
        id: "os-q12",
        type: "multiple-choice",
        conceptIds: ["시스템 콜", "인터럽트", "파일 시스템"],
        prompt: "시스템 콜, 인터럽트, 파일 시스템에 대한 설명으로 옳은 것을 모두 고르세요.",
        choices: [
          { id: "a", label: "시스템 콜은 사용자 프로그램이 운영체제 서비스를 요청하는 통로이다." },
          { id: "b", label: "인터럽트는 CPU가 현재 작업을 멈추고 특정 사건을 처리하게 만들 수 있다." },
          { id: "c", label: "파일 시스템은 저장장치의 데이터를 파일과 디렉터리 구조로 관리한다." },
          { id: "d", label: "시스템 콜은 운영체제를 거치지 않고 하드웨어를 직접 제어하는 방식이다." },
          { id: "unknown", label: "잘 모르겠어요." },
        ],
        correctChoiceIds: ["a", "b", "c"],
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
        type: "multiple-choice",
        conceptIds: ["미분", "경사하강법"],
        prompt: "경사하강법에서 미분값을 보는 이유로 가장 적절한 것은?",
        choices: [
          { id: "a", label: "손실이 줄어드는 방향과 변화 정도를 알 수 있어서" },
          { id: "b", label: "데이터 개수를 자동으로 늘릴 수 있어서" },
          { id: "c", label: "모델의 출력값을 항상 0으로 만들 수 있어서" },
          { id: "unknown", label: "잘 모르겠어요." },
        ],
        correctChoiceId: "a",
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
        type: "multiple-choice",
        conceptIds: ["트랜잭션", "격리 수준"],
        prompt: "트랜잭션에서 격리 수준이 필요한 이유는 무엇인가요?",
        choices: [
          { id: "a", label: "동시 실행 중 발생할 수 있는 충돌과 이상 현상을 제어하기 위해" },
          { id: "b", label: "모든 테이블의 컬럼 수를 동일하게 만들기 위해" },
          { id: "c", label: "데이터베이스 접속 속도를 항상 일정하게 만들기 위해" },
          { id: "unknown", label: "잘 모르겠어요." },
        ],
        correctChoiceId: "a",
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
        type: "multiple-choice",
        conceptIds: ["OSI 7계층", "라우팅"],
        prompt: "라우팅이 네트워크 계층에서 다뤄지는 이유로 가장 적절한 것은?",
        choices: [
          { id: "a", label: "목적지까지 패킷이 이동할 경로를 결정해야 하기 때문이다." },
          { id: "b", label: "사용자 화면의 글꼴과 색상을 결정해야 하기 때문이다." },
          { id: "c", label: "응용 프로그램의 로그인 상태만 관리하기 때문이다." },
          { id: "unknown", label: "잘 모르겠어요." },
        ],
        correctChoiceId: "a",
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

function uniqueStrings(values) {
  return [...new Set(values.filter(Boolean))];
}

function toArray(value) {
  if (Array.isArray(value)) {
    return value;
  }

  return value ? [value] : [];
}

export function getDiagnosisConceptLabel(value) {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  return (
    value.display_name ||
    value.displayName ||
    value.korean_name ||
    value.koreanName ||
    value.concept_name ||
    value.conceptName ||
    value.name ||
    value.canonical_name ||
    value.canonicalName ||
    value.concept_id ||
    value.conceptId ||
    value.node_id ||
    value.nodeId ||
    value.label ||
    value.title ||
    ""
  );
}

function getConceptLabel(value) {
  return getDiagnosisConceptLabel(value);
}

export function normalizeDiagnosisConceptId(value) {
  if (!value) {
    return "";
  }

  if (typeof value === "object") {
    const explicitId = value.node_id || value.nodeId || value.concept_id || value.conceptId || value.id;

    if (explicitId) {
      return String(explicitId);
    }

    return slugifyConcept(getConceptLabel(value));
  }

  return slugifyConcept(String(value));
}

export function createDiagnosisConcept(value) {
  const label = getConceptLabel(value);
  const id = normalizeDiagnosisConceptId(value || label);

  if (!id || !label) {
    return null;
  }

  return {
    id,
    label,
    sourceStatus:
      typeof value === "object" ? value.status || value.diagnosis_label || value.diagnosisLabel : undefined,
  };
}

function normalizeConceptReferences(values) {
  const references = Array.isArray(values) ? values : values ? [values] : [];

  return uniqueStrings(references.map((reference) => normalizeDiagnosisConceptId(reference)));
}

function getChoiceConceptReferences(choice) {
  if (!choice || typeof choice !== "object") {
    return [];
  }

  return (
    choice.conceptIds ||
    choice.concept_ids ||
    choice.nodeIds ||
    choice.node_ids ||
    choice.concepts ||
    choice.nodes ||
    choice.conceptId ||
    choice.concept_id ||
    choice.nodeId ||
    choice.node_id ||
    []
  );
}

function getQuestionCoreConceptReferences(question) {
  return (
    question.coreConceptIds ||
    question.core_concept_ids ||
    question.centralConceptIds ||
    question.central_concept_ids ||
    question.mainConceptIds ||
    question.main_concept_ids ||
    question.coreConceptId ||
    question.core_concept_id ||
    question.centralConceptId ||
    question.central_concept_id ||
    (question.node_id
      ? {
          node_id: question.node_id,
          display_name: question.display_name,
          korean_name: question.korean_name,
          concept_name: question.concept_name,
          name: question.node_name || question.name,
          canonical_name: question.canonical_name,
          concept_id: question.concept_id,
        }
      : null) ||
    []
  );
}

function getQuestionChoiceConceptIds(question) {
  return uniqueStrings(
    (question.choices || []).flatMap((choice) => normalizeConceptReferences(getChoiceConceptReferences(choice)))
  );
}

function getCorrectChoiceIds(question) {
  const correctChoiceIds = question.correctChoiceIds || question.correct_choice_ids || (question.correctChoiceId ? [question.correctChoiceId] : []);

  return correctChoiceIds.map((choiceId) => String(choiceId));
}

function getQuestionInvolvedConceptIds(question) {
  return uniqueStrings([
    ...(question.conceptIds || []),
    ...(question.coreConceptIds || []),
    ...getQuestionChoiceConceptIds(question),
  ]);
}

function buildDiagnosisConcepts(projectData, template) {
  const concepts = [
    ...(projectData.graphNodes || []),
    ...(template.concepts || []),
    ...(template.questions || []).flatMap((question) => [
      ...(question.conceptIds || []),
      ...(question.coreConceptIds || []),
      ...((question.choices || []).flatMap((choice) => getChoiceConceptReferences(choice))),
    ]),
  ];

  const conceptMap = new Map();

  concepts.forEach((conceptLike) => {
    const concept = createDiagnosisConcept(conceptLike);

    if (concept && !conceptMap.has(concept.id)) {
      conceptMap.set(concept.id, concept);
    }
  });

  return [...conceptMap.values()];
}

export function buildApiDiagnosisConcepts(graphNodes = [], question = null) {
  const conceptMap = new Map();

  function addConcept(conceptLike) {
    const concept = createDiagnosisConcept(conceptLike);

    if (concept && !conceptMap.has(concept.id)) {
      conceptMap.set(concept.id, concept);
    }
  }

  (graphNodes || []).forEach((conceptLike) => {
    addConcept(conceptLike);
  });

  if (question) {
    const generatedQuestionQueue = [
      ...toArray(question.generated_question_queue),
      ...toArray(question.generatedQuestionQueue),
      ...toArray(question.question_queue),
      ...toArray(question.questionQueue),
      ...toArray(question.generated_questions),
      ...toArray(question.generatedQuestions),
    ];
    const questionConcepts = [
      {
        node_id: question.node_id,
        display_name: question.display_name,
        korean_name: question.korean_name,
        concept_name: question.concept_name,
        name: question.node_name || question.name,
        canonical_name: question.canonical_name,
        concept_id: question.concept_id,
      },
      ...toArray(question.concepts),
      ...toArray(question.nodes),
      ...((question.choices || []).flatMap((choice) => getChoiceConceptReferences(choice))),
      ...generatedQuestionQueue.flatMap((queuedQuestion) => [
        queuedQuestion,
        queuedQuestion?.concept,
        queuedQuestion?.node,
        ...toArray(queuedQuestion?.concepts),
        ...toArray(queuedQuestion?.nodes),
        ...((queuedQuestion?.choices || []).flatMap((choice) => getChoiceConceptReferences(choice))),
      ]),
    ];

    questionConcepts.forEach((conceptLike) => {
      addConcept(conceptLike);
    });
  }

  return [...conceptMap.values()];
}

function getQuestionConceptFallbacks(question) {
  if (!question) {
    return [];
  }

  return [
    {
      node_id: question.node_id,
      display_name: question.display_name,
      korean_name: question.korean_name,
      concept_name: question.concept_name,
      name: question.node_name || question.name,
      canonical_name: question.canonical_name,
      concept_id: question.concept_id,
    },
    ...toArray(question.concepts),
    ...toArray(question.nodes),
    ...(question.conceptIds || []),
    ...(question.coreConceptIds || []),
    ...((question.choices || []).flatMap((choice) => getChoiceConceptReferences(choice))),
  ];
}

function getDiagnosisStatusFromLabel(label) {
  if (label === diagnosisStatusMap.understood.label || label === "이해") {
    return diagnosisStatusMap.understood;
  }
  if (
    label === diagnosisStatusMap.needsReview.label ||
    label === "추가 학습" ||
    label === "추가 학습 필요"
  ) {
    return diagnosisStatusMap.needsReview;
  }
  if (label === diagnosisStatusMap.inProgress.label || label === "진행 중") {
    return diagnosisStatusMap.inProgress;
  }

  return diagnosisStatusMap.unknown;
}

export function normalizeDiagnosisQuestion(question) {
  const coreConceptIds = normalizeConceptReferences(getQuestionCoreConceptReferences(question));
  const choiceConceptIds = getQuestionChoiceConceptIds(question);
  const conceptIds = uniqueStrings([
    ...normalizeConceptReferences(question.conceptIds || question.concept_ids || []),
    ...coreConceptIds,
    ...choiceConceptIds,
  ]);

  return {
    ...question,
    coreConceptIds: coreConceptIds.length ? coreConceptIds : conceptIds.slice(0, 1),
    conceptIds,
    choices: (question.choices || []).map((choice) => ({
      ...choice,
      conceptIds: normalizeConceptReferences(getChoiceConceptReferences(choice)),
    })),
  };
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
        type: "multiple-choice",
        conceptIds: [normalizedConcepts[1] || normalizedConcepts[0], normalizedConcepts[2] || normalizedConcepts[0]],
        prompt: `지금 ${projectData.title}에서 가장 필요한 학습 방식은 무엇인가요?`,
        choices: [
          { id: "a", label: "핵심 정의를 예시와 함께 다시 정리하고 싶어요." },
          { id: "b", label: "개념 사이의 연결 관계만 빠르게 확인하고 싶어요." },
          { id: "c", label: "이미 충분히 이해해서 바로 응용으로 넘어가고 싶어요." },
          { id: "unknown", label: "잘 모르겠어요." },
        ],
        correctChoiceId: "a",
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
  const concepts = buildDiagnosisConcepts(projectData, template);

  return {
    id: `${projectData.projectId}-diagnosis-session`,
    projectId: projectData.projectId,
    projectTitle: projectData.title,
    totalQuestions: template.questions.length,
    estimatedMinutes: 6,
    concepts,
    questions: template.questions.map((question, index) => ({
      ...normalizeDiagnosisQuestion(question),
      order: index + 1,
    })),
  };
}

export function createEmptyAnswers(session) {
  return session.questions.reduce((result, question) => {
    result[question.id] = question.type === "multiple-choice" ? [] : "";
    return result;
  }, {});
}

function normalizeText(value) {
  return value.trim().toLowerCase();
}

function normalizeSelectedChoices(answer) {
  if (Array.isArray(answer)) {
    return answer.filter(Boolean).map((choiceId) => String(choiceId));
  }

  return answer ? [String(answer)] : [];
}

export function isAnswerReady(question, answer) {
  if (!question) {
    return false;
  }

  if (question.type === "short-answer") {
    return typeof answer === "string" && answer.trim().length >= 2;
  }

  return normalizeSelectedChoices(answer).length > 0;
}

export function evaluateQuestion(question, answer) {
  if (question.type === "multiple-choice") {
    const selectedChoiceIds = normalizeSelectedChoices(answer);
    const correctChoiceIds = getCorrectChoiceIds(question);
    const selectedSet = new Set(selectedChoiceIds);
    const correctSet = new Set(correctChoiceIds);
    const isCorrect =
      selectedSet.size === correctSet.size && [...selectedSet].every((choiceId) => correctSet.has(choiceId));

    return {
      correct: isCorrect,
      confidence: isCorrect ? 1 : 0,
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
  const conceptMap = new Map();

  [...(session.concepts || []), ...(session.questions || []).flatMap(getQuestionConceptFallbacks)].forEach((conceptLike) => {
    const concept = createDiagnosisConcept(conceptLike);

    if (concept && !conceptMap.has(concept.id)) {
      conceptMap.set(concept.id, concept);
    }
  });

  const statuses = new Map(
    [...conceptMap.values()].map((concept) => {
      const initialStatus = getDiagnosisStatusFromLabel(concept.sourceStatus);

      return [
        concept.id,
        {
          ...concept,
          status: initialStatus.label,
          tone: initialStatus.tone,
        },
      ];
    })
  );

  session.questions.forEach((question, index) => {
    const answer = answers[question.id];
    const hasAnswer = isAnswerReady(question, answer);
    const coreConceptIds = question.coreConceptIds?.length ? question.coreConceptIds : question.conceptIds || [];

    if (!hasAnswer && !isComplete && index === currentQuestionIndex) {
      coreConceptIds.forEach((conceptId) => {
        const concept = statuses.get(conceptId);

        if (concept) {
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
    const selectedChoiceIds = normalizeSelectedChoices(answer);
    const selectedChoiceIdSet = new Set(selectedChoiceIds);
    const correctChoiceIds = getCorrectChoiceIds(question);
    const correctChoiceIdSet = new Set(correctChoiceIds);
    const conceptIdsToUpdate = evaluation.correct
      ? getQuestionInvolvedConceptIds(question)
      : uniqueStrings([
          ...coreConceptIds,
          ...(question.choices || [])
            .filter((choice) => correctChoiceIdSet.has(choice.id) && !selectedChoiceIdSet.has(choice.id))
            .flatMap((choice) => choice.conceptIds || []),
        ]);
    const nextStatus = evaluation.correct ? diagnosisStatusMap.understood : diagnosisStatusMap.needsReview;

    conceptIdsToUpdate.forEach((conceptId) => {
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
