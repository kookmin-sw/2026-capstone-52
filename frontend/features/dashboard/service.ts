import { projectCatalog } from "../project/model";
import { apiRequest } from "../api/client";
import { ensureCurrentUser } from "../api/session";
import {
  createProjectMemo as createLocalProjectMemo,
  deleteProjectMemo as deleteLocalProjectMemo,
  deleteProjectState,
  getProjectMemos as getLocalProjectMemos,
  loadWorkspaceState,
  saveWorkspaceState,
  updateProjectMemo as updateLocalProjectMemo,
  upsertProjectState,
} from "../workspace/storage";
import type { Chat, ChatSession, DashboardChatStore, Project, ProjectCatalogOption, ProjectMemo } from "./types";

const DASHBOARD_CHAT_STORAGE_KEY = "eeum-dashboard-chats-v1";
const DASHBOARD_CHAT_STORE_VERSION = 2;
const isBackendApiEnabled = process.env.NEXT_PUBLIC_USE_BACKEND_API === "true";
export const isDashboardBackendApiEnabled = isBackendApiEnabled;
const MOCK_CHAT_RESPONSE_DELAY_MS = 5000;

function delay(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

const MOCK_PROJECT_CATALOG: ProjectCatalogOption[] = [
  {
    id: "os",
    title: "운영체제",
    description: "프로세스, 스레드, CPU 스케줄링, 메모리 관리 흐름을 정리합니다.",
    domain: "Computer Science",
    level: "기초-중급",
    estimatedTime: "4주",
  },
  {
    id: "data-structures",
    title: "자료구조",
    description: "스택, 큐, 트리, 그래프, 해시 테이블을 구현 관점에서 학습합니다.",
    domain: "Computer Science",
    level: "기초",
    estimatedTime: "3주",
  },
  {
    id: "network",
    title: "컴퓨터 네트워크",
    description: "TCP/IP, HTTP, 라우팅, 흐름 제어와 혼잡 제어를 연결해서 봅니다.",
    domain: "Computer Science",
    level: "중급",
    estimatedTime: "4주",
  },
  {
    id: "algorithm",
    title: "알고리즘",
    description: "시간복잡도, 정렬, 탐색, 그래프 알고리즘, 동적계획법을 다룹니다.",
    domain: "Computer Science",
    level: "기초-중급",
    estimatedTime: "5주",
  },
];

const PROJECT_DOMAIN_BY_CATALOG_ID: Record<string, string> = {
  os: "operating_system",
  "data-structures": "data_structure",
  network: "computer_network",
  algorithm: "algorithm",
};

const CATALOG_ID_BY_PROJECT_DOMAIN: Record<string, string> = {
  operating_system: "os",
  data_structure: "data-structures",
  computer_network: "network",
  algorithm: "algorithm",
  os: "os",
  "data-structures": "data-structures",
  network: "network",
};

const CATALOG_PROJECT_IDS = new Set(MOCK_PROJECT_CATALOG.map((project) => project.id));

type ApiProject = {
  project_id: number | string;
  project_name: string;
  project_description?: string | null;
  project_domain?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  last_accessed_at?: string | null;
};

type ApiChatLog = {
  chat_id: number | string;
  project_id: number | string;
  user_message: string;
  ai_response?: string | null;
  response_type?: string | null;
  created_at?: string | null;
  concept_counting?: {
    turn_count?: number;
    check_interval?: number;
    should_check_quiz?: boolean;
    counted_concepts?: Array<{ node_id: string; name: string; mention_count?: number }>;
    quiz_ready_concepts?: Array<{ node_id: string; name: string; mention_count?: number }>;
  } | null;
};

type ApiChatSession = {
  id: number | string;
  project_id: number | string;
  title?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type ApiProjectMemo = {
  memo_id: number | string;
  project_id: number | string;
  title?: string | null;
  content?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type ApiGraphNode = {
  node_id: string;
  project_id: number | string;
  file_id?: string | null;
  concept_id?: string | null;
  name: string;
  display_name?: string | null;
  description?: string | null;
  group?: string | null;
  status?: string | null;
  updated_at?: string | null;
};

function normalizeApiDate(value: string | null | undefined) {
  if (!value) {
    return new Date().toISOString();
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function normalizeApiProject(project: ApiProject): Project {
  const catalogProject = project.project_domain ? getCatalogProjectByDomain(project.project_domain) : null;
  const catalogId = project.project_domain ? CATALOG_ID_BY_PROJECT_DOMAIN[project.project_domain] : null;

  return {
    id: String(project.project_id),
    title: catalogProject?.title || project.project_name,
    updatedAt: normalizeApiDate(project.last_accessed_at || project.updated_at || project.created_at),
    domain: catalogId ? PROJECT_DOMAIN_BY_CATALOG_ID[catalogId] : project.project_domain || null,
  };
}

function normalizeApiProjectMemo(memo: ApiProjectMemo): ProjectMemo {
  return {
    memoId: String(memo.memo_id),
    projectId: String(memo.project_id),
    title: memo.title?.trim() || "Untitled",
    content: memo.content || "",
    createdAt: memo.created_at || null,
    updatedAt: memo.updated_at || null,
  };
}

function getCatalogProjectByDomain(projectDomain: string) {
  const catalogId = CATALOG_ID_BY_PROJECT_DOMAIN[projectDomain];
  return catalogId ? MOCK_PROJECT_CATALOG.find((project) => project.id === catalogId) || null : null;
}

function isCatalogProject(project: Project) {
  if (project.domain) {
    return Boolean(getCatalogProjectByDomain(project.domain));
  }

  return CATALOG_PROJECT_IDS.has(project.id);
}

function hasServerActivityTimestamp(project: ApiProject) {
  return Boolean(project.last_accessed_at);
}

function getLatestApiChatUpdatedAt(logs: ApiChatLog[]) {
  return logs.reduce((latest, log) => {
    const chatTime = Date.parse(normalizeApiDate(log.created_at));
    return Number.isNaN(chatTime) ? latest : Math.max(latest, chatTime);
  }, 0);
}

function buildChatSessionThreadId(projectId: string, sessionId: number | string) {
  return `${projectId}-session-${sessionId}`;
}

function getChatSessionIdFromThreadId(projectId: string, chatId: string | null | undefined) {
  const prefix = `${projectId}-session-`;
  if (!chatId || !chatId.startsWith(prefix)) {
    return null;
  }

  const sessionId = Number(chatId.slice(prefix.length));
  return Number.isFinite(sessionId) ? sessionId : null;
}

function normalizeApiChatSession(session: ApiChatSession): ChatSession {
  return {
    id: Number(session.id),
    project_id: Number(session.project_id),
    title: session.title?.trim() || "새 채팅방",
    created_at: normalizeApiDate(session.created_at),
    updated_at: normalizeApiDate(session.updated_at || session.created_at),
  };
}

async function applyApiChatUpdatedAt(project: Project): Promise<Project> {
  try {
    const chats = await apiRequest(`/chat/project/${encodeURIComponent(project.id)}`, {
      method: "GET",
    });
    const latestChatTime = Array.isArray(chats) ? getLatestApiChatUpdatedAt(chats) : 0;
    const projectTime = Date.parse(project.updatedAt);
    const effectiveTime = Math.max(Number.isNaN(projectTime) ? 0 : projectTime, latestChatTime);

    return {
      ...project,
      updatedAt: effectiveTime ? new Date(effectiveTime).toISOString() : project.updatedAt,
    };
  } catch {
    return project;
  }
}

function buildApiThread(projectId: string, session: ChatSession, logs: ApiChatLog[]): Chat {
  const sortedLogs = logs
    .slice()
    .sort((left, right) => Date.parse(normalizeApiDate(left.created_at)) - Date.parse(normalizeApiDate(right.created_at)));
  const threadId = buildChatSessionThreadId(projectId, session.id);
  const threadTitle = session.title?.trim() || "새 채팅방";
  const messages = sortedLogs.flatMap((log) => {
    const isDiagnosisReport = typeof log.response_type === "string" && log.response_type.startsWith("diagnosis_report");
    const isDiagnosisReportSummary = log.response_type === "diagnosis_report_summary";
    const isMiniQuizResult = log.response_type === "mini_quiz_result";
    // 백엔드는 미니퀴즈 결과 채팅을 "미니퀴즈 결과"라는 user_message 마커와 함께 저장 — 실제 사용자 발화가 아니므로 숨긴다.
    const userMessage = !isDiagnosisReport && !isMiniQuizResult
      ? {
          id: `api-chat-${log.chat_id}-user`,
          role: "user" as const,
          text: log.user_message,
        }
      : null;
    const quizReadyConcepts = Array.isArray(log.concept_counting?.quiz_ready_concepts)
      ? log.concept_counting?.quiz_ready_concepts ?? []
      : [];
    const assistantMessage = log.ai_response
      ? {
          id: `api-chat-${log.chat_id}-assistant`,
          role: "assistant" as const,
          text: log.ai_response,
          variant: isDiagnosisReport
            ? ("diagnosis-report" as const)
            : isMiniQuizResult
              ? ("mini-quiz-result" as const)
              : undefined,
          attachment: isDiagnosisReportSummary ? ({ type: "graph-preview" } as const) : undefined,
          miniQuizReady: quizReadyConcepts.length
            ? quizReadyConcepts.map((concept) => ({ nodeId: concept.node_id, name: concept.name }))
            : undefined,
        }
      : null;

    const parts: Array<NonNullable<typeof userMessage> | NonNullable<typeof assistantMessage>> = [];
    if (userMessage) parts.push(userMessage);
    if (assistantMessage) parts.push(assistantMessage);
    return parts;
  });
  const latest = sortedLogs[sortedLogs.length - 1];
  const sessionUpdatedTime = Date.parse(normalizeApiDate(session.updated_at || session.created_at));
  const latestLogTime = latest ? Date.parse(normalizeApiDate(latest.created_at)) : 0;
  const effectiveUpdatedTime = Math.max(
    Number.isNaN(sessionUpdatedTime) ? 0 : sessionUpdatedTime,
    Number.isNaN(latestLogTime) ? 0 : latestLogTime
  );

  return {
    id: threadId,
    projectId,
    title: threadTitle,
    updatedAt: effectiveUpdatedTime
      ? new Date(effectiveUpdatedTime).toISOString()
      : normalizeApiDate(session.updated_at || latest?.created_at || session.created_at),
    messages: messages.length
      ? messages
      : [
          {
            id: `${threadId}-assistant-starter`,
            role: "assistant",
            text: `${threadTitle}에서 업로드한 자료나 그래프를 바탕으로 궁금한 점을 물어보세요.`,
          },
        ],
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function canUseStorage() {
  return typeof window !== "undefined";
}

function createEmptyChatStore(): DashboardChatStore {
  return {
    version: DASHBOARD_CHAT_STORE_VERSION,
    chatsByProject: {},
  };
}

function isChatRecord(value: unknown): value is Chat {
  if (!value || typeof value !== "object") {
    return false;
  }

  const chat = value as Partial<Chat>;

  return typeof chat.id === "string" && typeof chat.projectId === "string" && Array.isArray(chat.messages);
}

function isDiagnosisReportChat(chat: Chat) {
  return chat.id.includes("-diagnosis-report-") || chat.messages.some((message) => message.variant === "diagnosis-report");
}

function shouldKeepPersistedLocalChat(chat: Chat) {
  return isDiagnosisReportChat(chat) || chat.messages.length === 0;
}

function pickPersistedChatsByProject(chatsByProject: unknown): Record<string, Chat[]> {
  if (!chatsByProject || typeof chatsByProject !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(chatsByProject as Record<string, unknown>)
      .map(([projectId, chats]) => [
        projectId,
        Array.isArray(chats) ? chats.filter(isChatRecord).filter(shouldKeepPersistedLocalChat) : [],
      ])
      .filter(([, chats]) => chats.length)
  ) as Record<string, Chat[]>;
}

function ensureWorkspaceProjectTimestamps(projects: Project[]) {
  const fallbackTimes = [
    "2026-04-11T16:20:00.000Z",
    "2026-04-12T04:20:00.000Z",
    "2026-04-08T14:15:00.000Z",
    "2026-04-11T08:30:00.000Z",
    "2026-04-07T07:45:00.000Z",
    "2026-04-12T10:30:00.000Z",
    "2026-04-13T13:00:00.000Z",
  ];

  return projects.map((project, index) => ({
    ...project,
    updatedAt:
      typeof project.updatedAt === "string" && !Number.isNaN(Date.parse(project.updatedAt))
        ? project.updatedAt
        : fallbackTimes[index] || new Date().toISOString(),
  }));
}

function loadChatStore(): DashboardChatStore {
  if (!canUseStorage()) {
    return createEmptyChatStore();
  }

  try {
    const raw = window.localStorage.getItem(DASHBOARD_CHAT_STORAGE_KEY);

    if (!raw) {
      const seed = createEmptyChatStore();
      window.localStorage.setItem(DASHBOARD_CHAT_STORAGE_KEY, JSON.stringify(seed));
      return seed;
    }

    const parsed = JSON.parse(raw);
    if (parsed?.version !== DASHBOARD_CHAT_STORE_VERSION) {
      const seed = createEmptyChatStore();
      window.localStorage.setItem(DASHBOARD_CHAT_STORAGE_KEY, JSON.stringify(seed));
      return seed;
    }

    const chatsByProject = pickPersistedChatsByProject(parsed?.chatsByProject);
    const nextStore = {
      version: DASHBOARD_CHAT_STORE_VERSION,
      chatsByProject,
    };

    if (JSON.stringify(nextStore) !== raw) {
      window.localStorage.setItem(DASHBOARD_CHAT_STORAGE_KEY, JSON.stringify(nextStore));
    }

    return nextStore;
  } catch {
    return createEmptyChatStore();
  }
}

function saveChatStore(store: DashboardChatStore) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(DASHBOARD_CHAT_STORAGE_KEY, JSON.stringify(store));
}

function getLatestChatUpdatedAt(chats: Chat[]) {
  return chats.reduce((latest, chat) => {
    const chatTime = Date.parse(chat.updatedAt);
    return Number.isNaN(chatTime) ? latest : Math.max(latest, chatTime);
  }, 0);
}

function sortChatsByUpdatedAt(chats: Chat[]) {
  return chats
    .slice()
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
}

function persistProjectUpdatedAt(projectId: string, updatedAt: string) {
  const workspaceState = loadWorkspaceState();
  const nextProjects = ensureWorkspaceProjectTimestamps(workspaceState.projects).map((project) =>
    project.id === projectId ? { ...project, updatedAt } : project
  );

  saveWorkspaceState({
    ...workspaceState,
    projects: nextProjects,
  });
}

function sortProjectsByUpdatedAt(projects: Project[], chatsByProject: Record<string, Chat[]>) {
  return ensureWorkspaceProjectTimestamps(projects)
    .map((project) => {
      const latestProjectTime = Date.parse(project.updatedAt);
      const latestChatTime = getLatestChatUpdatedAt(chatsByProject[project.id] || []);
      const effectiveUpdatedAt = new Date(
        Math.max(Number.isNaN(latestProjectTime) ? 0 : latestProjectTime, latestChatTime)
      ).toISOString();

      return {
        ...project,
        updatedAt: effectiveUpdatedAt,
      };
    })
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
}

function buildStarterChat(projectId: string, index: number): Chat {
  const now = new Date().toISOString();

  return {
    id: `${projectId}-chat-${Date.now()}`,
    projectId,
    title: `새 대화 ${index}`,
    updatedAt: now,
    messages: [],
  };
}

const OS_DIAGNOSIS_PDF_FLOW_TEXT = `혜민님, 이 PDF는 운영체제의 CPU 스케줄링 중 "비례 배분 / 공정 배분" 방식을 다루는 자료입니다.
핵심 흐름은 기존 성능 중심 스케줄링 -> 공정성 중심 스케줄링 -> Lottery Scheduling -> Stride Scheduling -> Linux CFS 순서로 이어집니다.

\`\`\`text
09. 스케줄링 - 비례 배분
│
├── 1. 비례 배분 스케줄링 개요
│   ├── 기존 스케줄링: 성능 중심
│   │   ├── Turnaround Time
│   │   └── Response Time
│   └── 비례 배분 스케줄링: 공정성 중심
│       └── 각 프로세스가 정해진 비율만큼 CPU를 사용하도록 함
│
├── 2. Lottery Scheduling
│   ├── 기본 개념
│   │   └── 티켓을 많이 가진 프로세스가 CPU를 받을 확률이 높음
│   ├── 특징
│   │   ├── 무작위 추첨 방식
│   │   └── 오래 실행할수록 목표 비율에 가까워짐
│   └── 한계
│       ├── 짧은 시간에는 정확한 비율 보장 어려움
│       └── 티켓 배분 기준이 필요함
│
├── 3. Stride Scheduling
│   ├── 등장 이유
│   │   └── Lottery Scheduling의 무작위성 보완
│   ├── 기본 개념
│   │   ├── 티켓 수에 따라 stride 계산
│   │   └── pass 값이 가장 작은 프로세스 실행
│   └── 특징
│       └── 무작위가 아닌 결정적 공정 배분 방식
│
├── 4. Linux CFS
│   ├── 기본 개념
│   │   └── Linux에서 사용하는 공정 스케줄러
│   ├── 핵심 기준
│   │   └── vruntime이 가장 작은 프로세스 선택
│   ├── 조절 요소
│   │   ├── sched_latency
│   │   ├── min_granularity
│   │   └── niceness / weight
│   └── 특징
│       └── 공정성과 성능 사이의 균형을 고려함
│
└── 5. 전체 정리
    ├── Lottery: 확률 기반 공정 배분
    ├── Stride: 계산 기반 공정 배분
    └── CFS: 실제 Linux의 공정 스케줄링 방식
\`\`\``;

const OS_DIAGNOSIS_RESULT_TEXT = `이번 퀴즈 결과를 보면, 전체적으로 **비례 배분 스케줄링의 큰 흐름은 이해하고 있지만**, 세부 개념인 **Stride Scheduling의 계산 방식**과 **CFS의 vruntime / weight 관계**에서 일부 혼동이 있는 것으로 보입니다.

PDF 구조상으로 보면 이해 상태는 다음과 같이 정리할 수 있습니다.

\`\`\`text
09. 스케줄링 - 비례 배분
│
├── 1. 비례 배분 스케줄링 개요
│   └── 이해 상태: 양호
│
├── 2. Lottery Scheduling
│   └── 이해 상태: 보통 이상
│
├── 3. Stride Scheduling
│   └── 이해 상태: 보완 필요
│
└── 4. Linux CFS
    └── 이해 상태: 보완 필요
\`\`\`

# 추천 학습 경로

현재 상태에서는 PDF를 처음부터 다시 전부 보는 것보다, 아래 순서로 다시 보는 것이 효율적입니다.

\`\`\`text
1단계. 비례 배분의 목표 다시 확인
   └── CPU를 빠르게 쓰는 것이 아니라 공정하게 나누는 것이 핵심

2단계. Lottery Scheduling 복습
   └── 티켓 = 확률
   └── 짧은 시간에는 정확한 비율 보장 어려움

3단계. Stride Scheduling 집중 복습
   └── ticket, stride, pass 관계 정리
   └── 실행 순서 예제 직접 따라가기

4단계. CFS 집중 복습
   └── vruntime이 가장 작은 프로세스 선택
   └── weight가 vruntime 증가 속도에 미치는 영향 정리

5단계. Lottery / Stride / CFS 비교
   └── 세 방식의 차이를 표로 정리
\`\`\``;

function buildDiagnosisReportText(projectTitle: string) {
  return [
    `${projectTitle} 수준진단 결과를 바탕으로 학습 리포트를 정리했어요.`,
    "핵심 개념은 어느 정도 이해하고 있지만, 일부 연결 개념은 예시와 함께 한 번 더 확인하면 좋아요.",
    "아래 그래프에서 현재 프로젝트의 개념 흐름을 먼저 훑고, 부족한 노드부터 이어서 질문해보세요.",
  ].join("\n");
}

function buildDiagnosisReportMessages(projectId: string, projectTitle: string, chatId: string): Chat["messages"] {
  if (!isBackendApiEnabled && projectId === "os") {
    return [
      {
        id: `${chatId}-assistant-pdf-flow`,
        role: "assistant",
        text: OS_DIAGNOSIS_PDF_FLOW_TEXT,
        variant: "diagnosis-report",
        collapsible: true,
      },
      {
        id: `${chatId}-assistant-result-summary`,
        role: "assistant",
        text: OS_DIAGNOSIS_RESULT_TEXT,
        variant: "diagnosis-report",
        collapsible: true,
        attachment: {
          type: "graph-preview",
        },
      },
    ];
  }

  return [
    {
      id: `${chatId}-assistant-report`,
      role: "assistant",
      text: buildDiagnosisReportText(projectTitle),
      variant: "diagnosis-report",
      attachment: {
        type: "graph-preview",
      },
    },
  ];
}

function buildDiagnosisReportChat(projectId: string, projectTitle: string, index: number): Chat {
  const now = new Date().toISOString();
  const chatId = `${projectId}-diagnosis-report-${Date.now()}`;

  return {
    id: chatId,
    projectId,
    title: !isBackendApiEnabled && projectId === "os" ? `비례 배분 스케줄링 진단 ${index}` : `수준진단 리포트 ${index}`,
    updatedAt: now,
    messages: buildDiagnosisReportMessages(projectId, projectTitle, chatId),
  };
}

export async function getProjects(): Promise<Project[]> {
  if (isBackendApiEnabled) {
    await ensureCurrentUser();

    const projects = await apiRequest("/projects/me", {
      method: "GET",
    });

    if (!Array.isArray(projects)) {
      return [];
    }

    const catalogProjectEntries = (projects as ApiProject[])
      .map((apiProject) => ({
        apiProject,
        project: normalizeApiProject(apiProject),
      }))
      .filter(({ project }) => isCatalogProject(project));
    // TODO: 백엔드가 채팅 저장 시 last_accessed_at을 항상 갱신하면 applyApiChatUpdatedAt 보정을 제거한다.
    const effectiveProjects = await Promise.all(
      catalogProjectEntries.map(({ apiProject, project }) =>
        hasServerActivityTimestamp(apiProject) ? project : applyApiChatUpdatedAt(project)
      )
    );

    return effectiveProjects.sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
  }

  const workspaceState = loadWorkspaceState();
  const chatStore = loadChatStore();

  return sortProjectsByUpdatedAt(workspaceState.projects.filter(isCatalogProject), chatStore.chatsByProject);
}

export async function getProjectCatalogOptions(): Promise<ProjectCatalogOption[]> {
  return clone(MOCK_PROJECT_CATALOG);
}

export async function listChatSessions(projectId: string): Promise<ChatSession[]> {
  if (!isBackendApiEnabled) {
    return [];
  }

  const sessions = await apiRequest(`/projects/${encodeURIComponent(projectId)}/chat-sessions`, {
    method: "GET",
  });

  return Array.isArray(sessions)
    ? sessions
        .map((session) => normalizeApiChatSession(session as ApiChatSession))
        .filter((session) => Number.isFinite(session.id))
    : [];
}

export async function createChatSession(projectId: string, title?: string): Promise<ChatSession> {
  const session = await apiRequest(`/projects/${encodeURIComponent(projectId)}/chat-sessions`, {
    method: "POST",
    body: title?.trim() ? { title: title.trim() } : {},
  });

  return normalizeApiChatSession(session as ApiChatSession);
}

export async function deleteChatSession(projectId: string, sessionId: number): Promise<void> {
  await apiRequest(`/projects/${encodeURIComponent(projectId)}/chat-sessions/${encodeURIComponent(sessionId)}`, {
    method: "DELETE",
  });
}

export async function getSessionChats(projectId: string, sessionId: number): Promise<ApiChatLog[]> {
  const chats = await apiRequest(
    `/chat/${encodeURIComponent(projectId)}/sessions/${encodeURIComponent(sessionId)}`,
    {
      method: "GET",
    }
  );

  return Array.isArray(chats) ? (chats as ApiChatLog[]) : [];
}

export async function getProjectChats(projectId: string): Promise<Chat[]> {
  const chatStore = loadChatStore();
  const localChats = sortChatsByUpdatedAt(chatStore.chatsByProject[projectId] || []);

  if (isBackendApiEnabled) {
    const sessions = await listChatSessions(projectId);
    const chats = await Promise.all(
      sessions.map(async (session) => buildApiThread(projectId, session, await getSessionChats(projectId, session.id)))
    );

    return sortChatsByUpdatedAt(chats);
  }

  return localChats;
}

export async function selectProjectFromCatalog(projectId: string): Promise<Project> {
  const catalogProject = MOCK_PROJECT_CATALOG.find((project) => project.id === projectId);

  if (!catalogProject) {
    throw new Error("선택한 학습 프로젝트를 찾을 수 없습니다.");
  }

  if (isBackendApiEnabled) {
    const projectDomain = PROJECT_DOMAIN_BY_CATALOG_ID[catalogProject.id];

    if (!projectDomain) {
      throw new Error("프로젝트 도메인 값을 찾을 수 없습니다.");
    }

    const project = await apiRequest("/projects/", {
      method: "POST",
      body: {
        project_domain: projectDomain,
      },
    });

    return normalizeApiProject(project);
  }

  const now = new Date().toISOString();
  const catalogEntry = (projectCatalog as Record<string, { materials?: unknown[] }>)[catalogProject.id];
  const projectDomain = PROJECT_DOMAIN_BY_CATALOG_ID[catalogProject.id];

  if (!projectDomain) {
    throw new Error("프로젝트 도메인 값을 찾을 수 없습니다.");
  }

  const nextProject = {
    id: catalogProject.id,
    title: catalogProject.title,
    updatedAt: now,
    domain: projectDomain,
  };
  const currentWorkspaceState = loadWorkspaceState();
  const nextWorkspaceState = upsertProjectState(currentWorkspaceState, nextProject);

  saveWorkspaceState({
    ...nextWorkspaceState,
    materialsByProject: {
      ...nextWorkspaceState.materialsByProject,
      [nextProject.id]:
        currentWorkspaceState.materialsByProject[nextProject.id] ||
        clone(catalogEntry?.materials || []),
    },
    projects: ensureWorkspaceProjectTimestamps(nextWorkspaceState.projects),
  });

  const chatStore = loadChatStore();

  if (!chatStore.chatsByProject[nextProject.id]) {
    chatStore.chatsByProject[nextProject.id] = [];
    saveChatStore(chatStore);
  }

  return nextProject;
}

export async function deleteProject(projectId: string): Promise<void> {
  if (isBackendApiEnabled) {
    await apiRequest(`/projects/${encodeURIComponent(projectId)}`, {
      method: "DELETE",
    });
    return;
  }

  const nextWorkspaceState = deleteProjectState(loadWorkspaceState(), projectId);
  saveWorkspaceState(nextWorkspaceState);

  const chatStore = loadChatStore();
  const { [projectId]: _removed, ...nextChatsByProject } = chatStore.chatsByProject;
  saveChatStore({
    ...chatStore,
    chatsByProject: nextChatsByProject,
  });
}

export async function createChat(projectId: string): Promise<Chat> {
  if (isBackendApiEnabled) {
    const session = await createChatSession(projectId);
    return buildApiThread(projectId, session, []);
  }

  const projects = await getProjects();
  const project = projects.find((item) => item.id === projectId);

  if (!project) {
    throw new Error("선택한 프로젝트를 찾을 수 없습니다.");
  }

  const chatStore = loadChatStore();
  const existingChats = chatStore.chatsByProject[projectId] || [];
  const nextChat = buildStarterChat(projectId, existingChats.length + 1);

  chatStore.chatsByProject[projectId] = [nextChat, ...existingChats];
  saveChatStore(chatStore);
  persistProjectUpdatedAt(projectId, nextChat.updatedAt);

  return nextChat;
}

export async function removeChat(projectId: string, chatId: string): Promise<void> {
  if (isBackendApiEnabled) {
    const sessionId = getChatSessionIdFromThreadId(projectId, chatId);
    if (!sessionId) {
      throw new Error("삭제할 채팅방 세션을 찾을 수 없습니다.");
    }

    await deleteChatSession(projectId, sessionId);
    return;
  }

  const chatStore = loadChatStore();
  const existingChats = chatStore.chatsByProject[projectId] || [];

  chatStore.chatsByProject[projectId] = existingChats.filter((chat) => chat.id !== chatId);
  saveChatStore(chatStore);
}

export async function createDiagnosisReportChat(projectId: string): Promise<Chat> {
  const reportProjectId = isBackendApiEnabled ? projectId : "os";
  const projects = await getProjects();
  let project = projects.find((item) => item.id === reportProjectId);

  if (!project && !isBackendApiEnabled && CATALOG_PROJECT_IDS.has(reportProjectId)) {
    project = await selectProjectFromCatalog(reportProjectId);
  }

  if (!project) {
    throw new Error("선택한 프로젝트를 찾을 수 없습니다.");
  }

  const chatStore = loadChatStore();
  const existingChats = chatStore.chatsByProject[reportProjectId] || [];
  const existingReportCount = existingChats.filter((chat) => chat.id.includes("-diagnosis-report-")).length;
  const nextChat = buildDiagnosisReportChat(reportProjectId, project.title, existingReportCount + 1);

  chatStore.chatsByProject[reportProjectId] = [nextChat, ...existingChats];
  saveChatStore(chatStore);
  persistProjectUpdatedAt(reportProjectId, nextChat.updatedAt);

  return nextChat;
}

export async function sendChatMessage(projectId: string, chatId: string, message: string, responseType = "default") {
  if (!isBackendApiEnabled) {
    await delay(MOCK_CHAT_RESPONSE_DELAY_MS);
    throw new Error("백엔드 API 모드에서만 채팅 전송을 사용할 수 있습니다.");
  }

  const sessionId = getChatSessionIdFromThreadId(projectId, chatId);
  if (!sessionId) {
    throw new Error("메시지를 보낼 채팅방 세션을 찾을 수 없습니다.");
  }

  return apiRequest(`/chat/${encodeURIComponent(projectId)}?session_id=${encodeURIComponent(sessionId)}`, {
    method: "POST",
    body: {
      message,
      response_type: responseType,
    },
  });
}

export async function getProjectGraphData(projectId: string) {
  if (!isBackendApiEnabled) {
    return null;
  }

  return apiRequest(`/graph/${encodeURIComponent(projectId)}`, {
    method: "GET",
  });
}

export async function getRecentGraphNodes(projectId: string): Promise<ApiGraphNode[]> {
  if (!isBackendApiEnabled) {
    return [];
  }

  const nodes = await apiRequest(`/graph/${encodeURIComponent(projectId)}/recent`, {
    method: "GET",
  });

  return Array.isArray(nodes) ? nodes : [];
}

export async function getGraphNodeDetail(nodeId: string): Promise<ApiGraphNode | null> {
  if (!isBackendApiEnabled) {
    return null;
  }

  return apiRequest(`/graph/nodes/${encodeURIComponent(nodeId)}`, {
    method: "GET",
  });
}

export type GraphNodeQuizHistoryItem = {
  question_id: string;
  concept_id: string;
  question: string;
  choices: Array<{ option_id: string; text: string; is_correct: boolean; is_selected: boolean }>;
  correct_option_ids: string[];
  selected_option_ids: string[];
  is_fully_correct?: boolean | null;
  partial_score?: number | null;
  answer_score?: number | null;
  explanation?: string | null;
  // 현재 백엔드 quiz_review 응답에는 source가 없다. 프론트에서 즉시 합성한 미니퀴즈 결과만 source를 가질 수 있다.
  source?: "mini_quiz" | "diagnosis" | null;
};

export async function getGraphNodeQuizHistory(
  nodeId: string
): Promise<GraphNodeQuizHistoryItem[]> {
  if (!isBackendApiEnabled) {
    return [];
  }

  const data = await apiRequest(`/graph/nodes/${encodeURIComponent(nodeId)}/quiz-history`, {
    method: "GET",
  });

  if (!Array.isArray(data)) return [];

  // "풀은 문제"만 풀이 이력에 노출. 백엔드가 unanswered 도 같이 내려주면 프론트가 한 번 더 가드.
  return (data as GraphNodeQuizHistoryItem[]).filter(
    (entry) => entry.is_fully_correct !== null && entry.is_fully_correct !== undefined
  );
}

export async function createExplanation({
  projectId,
  nodeId = null,
  question,
  explanationStyle = null,
}: {
  projectId: string;
  nodeId?: string | null;
  question: string;
  explanationStyle?: "example" | "concise" | "step" | "deep" | null;
}): Promise<string> {
  if (!isBackendApiEnabled) {
    return "";
  }

  const numericProjectId = Number(projectId);
  if (!Number.isFinite(numericProjectId)) {
    throw new Error("백엔드 프로젝트 ID가 올바르지 않습니다.");
  }

  const allowedExplanationStyle =
    explanationStyle === "example" || explanationStyle === "concise" || explanationStyle === "step"
      ? explanationStyle
      : null;

  const result = await apiRequest("/explanation", {
    method: "POST",
    body: {
      project_id: numericProjectId,
      node_id: nodeId,
      question,
      ...(allowedExplanationStyle ? { explanation_style: allowedExplanationStyle } : {}),
    },
  });

  return typeof result?.explanation === "string" ? result.explanation : "";
}

export async function getProjectMemos(projectId: string): Promise<ProjectMemo[]> {
  if (isBackendApiEnabled) {
    const memos = await apiRequest(`/projects/${encodeURIComponent(projectId)}/memos`, {
      method: "GET",
    });

    return Array.isArray(memos) ? memos.map((memo) => normalizeApiProjectMemo(memo)) : [];
  }

  return getLocalProjectMemos(loadWorkspaceState(), projectId);
}

export async function createProjectMemo(
  projectId: string,
  { title, content = "" }: { title: string; content?: string }
): Promise<ProjectMemo> {
  if (isBackendApiEnabled) {
    const memo = await apiRequest(`/projects/${encodeURIComponent(projectId)}/memos`, {
      method: "POST",
      body: {
        title: title.trim() || "Untitled",
        content,
      },
    });

    return normalizeApiProjectMemo(memo);
  }

  const { state, memo } = createLocalProjectMemo(loadWorkspaceState(), projectId, {
    title: title.trim() || "Untitled",
    content,
  });
  saveWorkspaceState(state);

  return memo;
}

export async function updateProjectMemo(
  projectId: string,
  memoId: string,
  { title, content }: { title?: string; content?: string }
): Promise<ProjectMemo> {
  if (isBackendApiEnabled) {
    const body: { title?: string; content?: string } = {};

    if (title !== undefined) {
      body.title = title.trim() || "Untitled";
    }

    if (content !== undefined) {
      body.content = content;
    }

    const memo = await apiRequest(
      `/projects/${encodeURIComponent(projectId)}/memos/${encodeURIComponent(memoId)}`,
      {
        method: "PATCH",
        body,
      }
    );

    return normalizeApiProjectMemo(memo);
  }

  const { state, memo } = updateLocalProjectMemo(loadWorkspaceState(), projectId, memoId, {
    title,
    content,
  });
  saveWorkspaceState(state);

  if (!memo) {
    throw new Error("프로젝트 메모를 찾을 수 없습니다.");
  }

  return memo;
}

export async function deleteProjectMemo(projectId: string, memoId: string): Promise<void> {
  if (isBackendApiEnabled) {
    await apiRequest(`/projects/${encodeURIComponent(projectId)}/memos/${encodeURIComponent(memoId)}`, {
      method: "DELETE",
    });

    return;
  }

  saveWorkspaceState(deleteLocalProjectMemo(loadWorkspaceState(), projectId, memoId));
}
