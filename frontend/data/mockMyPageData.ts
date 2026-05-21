import type {
  DiagnosisSession,
  ExplanationStyleId,
  GraphNodeRecord,
  LearningTypeId,
  MyPageProject,
  MyPageStats,
  ProfileInfo,
  ProjectChatSummary,
  RecentLearningRecord,
  SelectOption,
} from "@/types/profile";

function toIsoDate(dateString: string) {
  return new Date(`${dateString}T00:00:00.000Z`).toISOString();
}

export const explanationStyleOptions: SelectOption<ExplanationStyleId>[] = [
  {
    value: "example",
    label: "예시 중심",
    description: "실생활 비유나 예시로 설명",
  },
  {
    value: "concise",
    label: "개념 중심",
    description: "핵심 개념 위주로 간결하게 설명",
  },
  {
    value: "step",
    label: "단계별 중심",
    description: "기초부터 차근차근 설명",
  },
];

export const learningTypeOptions: SelectOption<LearningTypeId>[] = [
  {
    value: "exam",
    label: "시험 대비",
    description: "시험에 나올 핵심 개념 위주",
  },
  {
    value: "concept",
    label: "개념 이해",
    description: "원리와 흐름을 깊게 이해",
  },
  {
    value: "project",
    label: "과제 / 프로젝트",
    description: "실습이나 과제에 바로 적용",
  },
  {
    value: "light",
    label: "가볍게 공부",
    description: "부담 없이 흥미 위주로 학습",
  },
];

export const languageOptions = ["한국어", "English", "日本語"] as const;

export const defaultProfile: ProfileInfo = {
  name: "이지안",
  language: "한국어",
  job: "대학생",
  major: "소프트웨어전공",
  explanationStyle: "example",
  learningType: "project",
  learningGoal: "Computer Science",
};

export const mockProjects: MyPageProject[] = [
  { id: "os", title: "운영체제 시험 정리", category: "CS" },
  { id: "ml", title: "머신러닝 개념 구조화", category: "AI" },
  { id: "db", title: "데이터베이스 프로젝트", category: "Backend" },
  { id: "algo", title: "알고리즘 면접 복습", category: "Algorithm" },
];

export const mockProjectChats: ProjectChatSummary[] = [
  { projectId: "os", totalChats: 28 },
  { projectId: "ml", totalChats: 21 },
  { projectId: "db", totalChats: 19 },
  { projectId: "algo", totalChats: 19 },
];

export const mockDiagnosisSessions: DiagnosisSession[] = [
  { id: "diag-1", createdAt: toIsoDate("2025-10-02") },
  { id: "diag-2", createdAt: toIsoDate("2025-10-08") },
  { id: "diag-3", createdAt: toIsoDate("2025-10-12") },
  { id: "diag-4", createdAt: toIsoDate("2025-10-15") },
  { id: "diag-5", createdAt: toIsoDate("2025-10-18") },
  { id: "diag-6", createdAt: toIsoDate("2025-10-20") },
  { id: "diag-7", createdAt: toIsoDate("2025-10-23") },
  { id: "diag-8", createdAt: toIsoDate("2025-10-25") },
  { id: "diag-9", createdAt: toIsoDate("2025-10-27") },
  { id: "diag-10", createdAt: toIsoDate("2025-10-29") },
  { id: "diag-11", createdAt: toIsoDate("2025-11-01") },
  { id: "diag-12", createdAt: toIsoDate("2025-11-03") },
  { id: "diag-13", createdAt: toIsoDate("2025-11-05") },
  { id: "diag-14", createdAt: toIsoDate("2025-11-07") },
  { id: "diag-15", createdAt: toIsoDate("2025-11-09") },
  { id: "diag-16", createdAt: toIsoDate("2025-11-11") },
  { id: "diag-17", createdAt: toIsoDate("2025-11-13") },
  { id: "diag-18", createdAt: toIsoDate("2025-11-15") },
  { id: "diag-19", createdAt: toIsoDate("2025-11-17") },
  { id: "diag-20", createdAt: toIsoDate("2025-11-19") },
  { id: "diag-21", createdAt: toIsoDate("2025-11-21") },
  { id: "diag-22", createdAt: toIsoDate("2025-11-24") },
  { id: "diag-23", createdAt: toIsoDate("2025-11-27") },
];

export const mockGraphNodes: GraphNodeRecord[] = [
  { id: "node-1", projectId: "os", name: "기아 현상", category: "운영체제", updatedAt: toIsoDate("2025-11-27"), color: "#4ade80", x: 18, y: 38, size: 1.3 },
  { id: "node-2", projectId: "ds", name: "이진 탐색 트리", category: "자료구조", updatedAt: toIsoDate("2025-11-25"), color: "#60a5fa", x: 23, y: 52, size: 0.9 },
  { id: "node-3", projectId: "algo", name: "다이나믹 프로그래밍", category: "알고리즘", updatedAt: toIsoDate("2025-11-22"), color: "#fb923c", x: 31, y: 43, size: 1.1 },
  { id: "node-4", projectId: "cs", name: "파이프라인 해저드", category: "컴퓨터구조", updatedAt: toIsoDate("2025-11-20"), color: "#8b5cf6", x: 60, y: 26, size: 1.25 },
  { id: "node-5", projectId: "os", name: "Round Robin 스케줄링", category: "운영체제", updatedAt: toIsoDate("2025-11-18"), color: "#4ade80", x: 68, y: 38, size: 0.95 },
  { id: "node-6", projectId: "ds", name: "힙(Heap) 정렬", category: "자료구조", updatedAt: toIsoDate("2025-11-13"), color: "#60a5fa", x: 72, y: 21, size: 1.05 },
  { id: "node-7", projectId: "db", name: "정규화 3NF", category: "데이터베이스", updatedAt: toIsoDate("2025-11-10"), color: "#f472b6", x: 47, y: 61, size: 1.2 },
  { id: "node-8", projectId: "db", name: "인덱스", category: "데이터베이스", updatedAt: toIsoDate("2025-11-08"), color: "#fb7185", x: 55, y: 74, size: 1.1 },
  { id: "node-9", projectId: "os", name: "세마포어", category: "운영체제", updatedAt: toIsoDate("2025-11-06"), color: "#4ade80", x: 42, y: 79, size: 0.92 },
  { id: "node-10", projectId: "algo", name: "이분 탐색", category: "알고리즘", updatedAt: toIsoDate("2025-11-04"), color: "#fb923c", x: 81, y: 61, size: 1.08 },
  { id: "node-11", projectId: "cs", name: "캐시 메모리", category: "컴퓨터구조", updatedAt: toIsoDate("2025-11-02"), color: "#8b5cf6", x: 88, y: 48, size: 0.88 },
  { id: "node-12", projectId: "ds", name: "그래프 순회", category: "자료구조", updatedAt: toIsoDate("2025-10-30"), color: "#60a5fa", x: 77, y: 74, size: 0.82 },
];

export const mockRecentLearningRecords: RecentLearningRecord[] = [
  {
    id: "mock-chat-os-1",
    projectId: "os",
    subject: "운영체제",
    nodeName: "비례 배분 스케줄링 진단",
    updatedAt: toIsoDate("2025-11-27"),
    accentColor: "#4ade80",
  },
  {
    id: "mock-chat-ds-1",
    projectId: "data-structures",
    subject: "자료구조",
    nodeName: "이진 탐색 트리 개념 질문",
    updatedAt: toIsoDate("2025-11-25"),
    accentColor: "#60a5fa",
  },
  {
    id: "mock-chat-algorithm-1",
    projectId: "algorithm",
    subject: "알고리즘",
    nodeName: "다이나믹 프로그래밍 복습",
    updatedAt: toIsoDate("2025-11-22"),
    accentColor: "#fb923c",
  },
  {
    id: "mock-chat-network-1",
    projectId: "network",
    subject: "컴퓨터 네트워크",
    nodeName: "TCP 흐름 제어 정리",
    updatedAt: toIsoDate("2025-11-20"),
    accentColor: "#8b5cf6",
  },
  {
    id: "mock-chat-os-2",
    projectId: "os",
    subject: "운영체제",
    nodeName: "Round Robin 스케줄링",
    updatedAt: toIsoDate("2025-11-18"),
    accentColor: "#f472b6",
  },
  {
    id: "mock-chat-network-2",
    projectId: "network",
    subject: "컴퓨터 네트워크",
    nodeName: "라우팅 테이블 질문",
    updatedAt: toIsoDate("2025-11-13"),
    accentColor: "#fb7185",
  },
];

export function getMyPageStats(): MyPageStats {
  return {
    projectCount: mockProjects.length,
    totalChats: mockProjectChats.reduce((sum, project) => sum + project.totalChats, 0),
    diagnosisCount: mockDiagnosisSessions.length,
    conceptCount: 47,
  };
}

export function getRecentLearningRecordsLast30Days(limit = 6) {
  return mockRecentLearningRecords
    .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))
    .slice(0, limit);
}

export function getExplanationStyleLabel(value: ExplanationStyleId) {
  return explanationStyleOptions.find((option) => option.value === value)?.label ?? value;
}

export function getLearningTypeLabel(value: LearningTypeId) {
  return learningTypeOptions.find((option) => option.value === value)?.label ?? value;
}
