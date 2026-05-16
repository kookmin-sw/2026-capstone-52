// 미니퀴즈 mock 데이터 — 백엔드 응답 shape 그대로 작성해서 backend on/off 전환 시 동일하게 동작.
//
// 백엔드 응답 shape:
//   POST /mini-quiz/{project_id}/generate?node_id=...
//     -> DiagnosisQuestionResponse
//        question_id: str
//        concept_id: str
//        difficulty: Optional[str]  ("easy" | "medium" | "hard")
//        question_type: str         ("concept_check" | "prerequisite_check" | "multi_select")
//        diagnosis_purpose: Optional[str]
//        question: str
//        choices: list[{ option_id: str, text: str }]
//
//   POST /mini-quiz/{project_id}/submit
//     -> MiniQuizAnswerResponse
//        is_fully_correct: Optional[bool]
//        partial_score: Optional[float]
//        answer_score: Optional[float]
//        answer_level: Optional[int]
//        correct_option_ids: list[str]
//        selected_option_ids: list[str]
//        missed_correct_option_ids: list[str]
//        wrong_selected_option_ids: list[str]
//        invalid_selected_option_ids: list[str]
//        updated_node: Optional[dict]
//
// 채팅 응답의 mini-quiz 트리거:
//   POST /chat/{project_id} -> concept_counting.quiz_ready_concepts: [{ node_id, name, mention_count }]

export const MOCK_MINI_QUIZ_READY_CONCEPTS = [
  { node_id: "mock-node-process", name: "프로세스", mention_count: 4 },
  { node_id: "mock-node-context-switch", name: "문맥 교환", mention_count: 3 },
  { node_id: "mock-node-fcfs", name: "FCFS 스케줄링", mention_count: 3 },
  { node_id: "mock-node-virtual-memory", name: "가상 메모리", mention_count: 4 },
  { node_id: "mock-node-deadlock", name: "교착 상태", mention_count: 3 },
];

const MOCK_QUESTIONS_BY_NODE_ID = {
  "mock-node-process": {
    question_id: "mock-q-process-001",
    concept_id: "mock-node-process",
    difficulty: "medium",
    question_type: "multi_select",
    diagnosis_purpose: "프로세스/스레드 개념 차이 점검",
    question: "프로세스와 스레드에 대한 설명으로 옳은 것을 모두 고르세요.",
    choices: [
      { option_id: "A", text: "프로세스는 독립된 주소 공간을 가진다." },
      { option_id: "B", text: "스레드는 같은 프로세스 내의 자원을 공유할 수 있다." },
      { option_id: "C", text: "스레드는 항상 프로세스보다 생성 비용이 크다." },
      { option_id: "D", text: "하나의 프로세스는 여러 개의 스레드를 가질 수 있다." },
      { option_id: "E", text: "잘 모르겠어요." },
    ],
  },
  "mock-node-context-switch": {
    question_id: "mock-q-context-switch-001",
    concept_id: "mock-node-context-switch",
    difficulty: "medium",
    question_type: "multi_select",
    diagnosis_purpose: "문맥 교환 비용/시점 이해 점검",
    question: "문맥 교환(Context Switching)에 대한 설명으로 옳은 것을 모두 고르세요.",
    choices: [
      { option_id: "A", text: "CPU가 실행할 프로세스나 스레드를 바꿀 때 발생한다." },
      { option_id: "B", text: "현재 실행 상태를 저장하고 다음 실행 상태를 복원한다." },
      { option_id: "C", text: "문맥 교환은 오버헤드를 발생시킬 수 있다." },
      { option_id: "D", text: "문맥 교환이 많아질수록 항상 성능이 향상된다." },
      { option_id: "E", text: "잘 모르겠어요." },
    ],
  },
  "mock-node-fcfs": {
    question_id: "mock-q-fcfs-001",
    concept_id: "mock-node-fcfs",
    difficulty: "easy",
    question_type: "multi_select",
    diagnosis_purpose: "FCFS 스케줄링 특징 점검",
    question: "FCFS 스케줄링에 대한 설명으로 옳은 것을 모두 고르세요.",
    choices: [
      { option_id: "A", text: "먼저 도착한 프로세스를 먼저 실행한다." },
      { option_id: "B", text: "구현이 비교적 단순하다." },
      { option_id: "C", text: "짧은 작업이 긴 작업 뒤에서 오래 기다릴 수 있다." },
      { option_id: "D", text: "항상 평균 대기 시간이 가장 짧다." },
      { option_id: "E", text: "잘 모르겠어요." },
    ],
  },
  "mock-node-virtual-memory": {
    question_id: "mock-q-virtual-memory-001",
    concept_id: "mock-node-virtual-memory",
    difficulty: "medium",
    question_type: "multi_select",
    diagnosis_purpose: "가상 메모리 동작 원리 점검",
    question: "가상 메모리에 대한 설명으로 옳은 것을 모두 고르세요.",
    choices: [
      { option_id: "A", text: "프로세스가 물리 메모리보다 큰 논리 주소 공간을 사용할 수 있게 한다." },
      { option_id: "B", text: "필요한 페이지를 메모리에 올리는 방식과 관련이 있다." },
      { option_id: "C", text: "가상 메모리를 사용하면 페이지 폴트가 절대 발생하지 않는다." },
      { option_id: "D", text: "메모리 관리의 유연성을 높일 수 있다." },
      { option_id: "E", text: "잘 모르겠어요." },
    ],
  },
  "mock-node-deadlock": {
    question_id: "mock-q-deadlock-001",
    concept_id: "mock-node-deadlock",
    difficulty: "hard",
    question_type: "multi_select",
    diagnosis_purpose: "교착 상태 정의 및 조건 점검",
    question: "교착 상태(Deadlock)에 대한 설명으로 옳은 것을 모두 고르세요.",
    choices: [
      { option_id: "A", text: "여러 프로세스가 서로가 가진 자원을 기다리며 진행하지 못하는 상태이다." },
      { option_id: "B", text: "상호 배제, 점유와 대기, 비선점, 순환 대기 조건과 관련이 있다." },
      { option_id: "C", text: "교착 상태가 발생하면 프로세스들이 계속 정상적으로 실행된다." },
      { option_id: "D", text: "자원 할당 순서를 제한하면 교착 상태 예방에 도움이 될 수 있다." },
      { option_id: "E", text: "잘 모르겠어요." },
    ],
  },
};

const MOCK_CORRECT_OPTIONS_BY_QUESTION_ID = {
  "mock-q-process-001": ["A", "B", "D"],
  "mock-q-context-switch-001": ["A", "B", "C"],
  "mock-q-fcfs-001": ["A", "B", "C"],
  "mock-q-virtual-memory-001": ["A", "B", "D"],
  "mock-q-deadlock-001": ["A", "B", "D"],
};

export function getMockMiniQuizQuestion(nodeId) {
  return MOCK_QUESTIONS_BY_NODE_ID[nodeId] || MOCK_QUESTIONS_BY_NODE_ID["mock-node-process"];
}

export function buildMockMiniQuizAnswerResponse(questionId, selectedOptionIds = [], isSkipped = false) {
  const correctOptionIds = MOCK_CORRECT_OPTIONS_BY_QUESTION_ID[questionId] || [];
  const selectedSet = new Set(selectedOptionIds);
  const correctSet = new Set(correctOptionIds);

  const wrongSelectedOptionIds = selectedOptionIds.filter((id) => !correctSet.has(id));
  const missedCorrectOptionIds = correctOptionIds.filter((id) => !selectedSet.has(id));
  const isFullyCorrect = !isSkipped && wrongSelectedOptionIds.length === 0 && missedCorrectOptionIds.length === 0;
  const partialScore = isSkipped
    ? 0
    : correctOptionIds.length
      ? correctOptionIds.filter((id) => selectedSet.has(id)).length / correctOptionIds.length
      : 0;

  return {
    is_fully_correct: isFullyCorrect,
    partial_score: Number(partialScore.toFixed(2)),
    answer_score: Number(partialScore.toFixed(2)),
    answer_level: isFullyCorrect ? 3 : partialScore >= 0.5 ? 2 : 1,
    correct_option_ids: correctOptionIds,
    selected_option_ids: selectedOptionIds,
    missed_correct_option_ids: missedCorrectOptionIds,
    wrong_selected_option_ids: wrongSelectedOptionIds,
    invalid_selected_option_ids: [],
    updated_node: {
      node_id: "mock-node-process",
      status: isFullyCorrect ? "MASTERED" : partialScore >= 0.5 ? "FAMILIAR" : "PARTIAL",
      understanding_score: Number(partialScore.toFixed(2)),
    },
  };
}
