import { projectCatalog } from "../project/model";
import { apiRequest } from "../api/client";
import { getCurrentUserId } from "../api/session";
import {
  getDefaultWorkspaceState,
  getProjectNote as getLocalProjectNote,
  loadWorkspaceState,
  saveProjectNote as saveLocalProjectNote,
  saveWorkspaceState,
  upsertProjectState,
} from "../workspace/storage";
import type { Chat, DashboardChatStore, Project, ProjectCatalogOption } from "./types";

const DASHBOARD_CHAT_STORAGE_KEY = "eeum-dashboard-chats-v1";
const isBackendApiEnabled = process.env.NEXT_PUBLIC_USE_BACKEND_API === "true";
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
  created_at?: string | null;
};

export type ApiGraphNode = {
  node_id: string;
  project_id: number | string;
  file_id?: string | null;
  name: string;
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
  return {
    id: String(project.project_id),
    title: project.project_name,
    updatedAt: normalizeApiDate(project.last_accessed_at || project.updated_at || project.created_at),
  };
}

function buildApiThread(projectId: string, projectTitle: string, logs: ApiChatLog[]): Chat {
  const sortedLogs = logs
    .slice()
    .sort((left, right) => Date.parse(normalizeApiDate(left.created_at)) - Date.parse(normalizeApiDate(right.created_at)));
  const messages = sortedLogs.flatMap((log) => {
    const userMessage = {
      id: `api-chat-${log.chat_id}-user`,
      role: "user" as const,
      text: log.user_message,
    };
    const assistantMessage = log.ai_response
      ? {
          id: `api-chat-${log.chat_id}-assistant`,
          role: "assistant" as const,
          text: log.ai_response,
        }
      : null;

    return assistantMessage ? [userMessage, assistantMessage] : [userMessage];
  });
  const latest = sortedLogs[sortedLogs.length - 1];
  const firstQuestion = sortedLogs.find((log) => log.user_message)?.user_message;

  return {
    id: `${projectId}-api-thread`,
    projectId,
    title: firstQuestion || `${projectTitle} 대화`,
    updatedAt: normalizeApiDate(latest?.created_at),
    messages: messages.length
      ? messages
      : [
          {
            id: `${projectId}-api-thread-assistant-starter`,
            role: "assistant",
            text: `${projectTitle} 프로젝트를 시작했어요. 업로드한 자료나 그래프를 바탕으로 궁금한 점을 물어보세요.`,
          },
        ],
  };
}

const DEFAULT_CHATS_BY_PROJECT: Record<string, Chat[]> = {
  calculus: [
    {
      id: "calculus-chat-1",
      projectId: "calculus",
      title: "접선의 방정식이 왜 기울기와 연결되나요?",
      updatedAt: "2026-04-11T16:20:00.000Z",
      messages: [
        {
          id: "calculus-chat-1-assistant-1",
          role: "assistant",
          text: "업로드한 PDF를 바탕으로 질문할 수 있습니다. 아직 대화가 많지 않다면, 먼저 궁금한 개념이나 목표를 짧게 적어보세요.",
        },
        {
          id: "calculus-chat-1-user-1",
          role: "user",
          text: "접선의 방정식이 왜 기울기와 연결되는지 설명해줘.",
        },
        {
          id: "calculus-chat-1-assistant-2",
          role: "assistant",
          text: "접선은 특정 점에서 곡선의 변화를 가장 잘 대표하는 직선입니다. 그래서 그 점에서의 순간 변화율이 곧 접선의 기울기가 됩니다.",
        },
      ],
    },
    {
      id: "calculus-chat-2",
      projectId: "calculus",
      title: "미분계수와 평균변화율 차이",
      updatedAt: "2026-04-09T09:10:00.000Z",
      messages: [
        {
          id: "calculus-chat-2-assistant-1",
          role: "assistant",
          text: "평균변화율은 두 점 사이를, 미분계수는 한 점에서의 순간 변화를 다룹니다.",
        },
        {
          id: "calculus-chat-2-user-1",
          role: "user",
          text: "미분계수와 평균변화율 차이를 짧게 정리해줘.",
        },
      ],
    },
  ],
  os: [
    {
      id: "os-chat-1",
      projectId: "os",
      title: "기아 현상이 왜 생기나요?",
      updatedAt: "2026-04-12T04:20:00.000Z",
      messages: [
        {
          id: "os-chat-1-assistant-1",
          role: "assistant",
          text: "우선순위가 낮은 프로세스가 계속 선점되지 못하면 기아 현상이 생길 수 있습니다.",
        },
        {
          id: "os-chat-1-user-1",
          role: "user",
          text: "기아 현상이 왜 생기는지 예시와 함께 설명해줘.",
        },
        {
          id: "os-chat-1-assistant-2",
          role: "assistant",
          text: "높은 우선순위 작업이 계속 들어오면 낮은 우선순위 작업은 CPU를 받지 못합니다. 이런 상태가 오래 지속되면 기아 현상이라고 부릅니다.",
        },
      ],
    },
    {
      id: "os-chat-2",
      projectId: "os",
      title: "Round Robin과 FCFS 비교",
      updatedAt: "2026-04-10T11:40:00.000Z",
      messages: [
        {
          id: "os-chat-2-user-1",
          role: "user",
          text: "Round Robin과 FCFS의 차이를 표처럼 정리해줘.",
        },
        {
          id: "os-chat-2-assistant-1",
          role: "assistant",
          text: "FCFS는 먼저 들어온 작업을 끝까지 처리하고, Round Robin은 time quantum 기준으로 작업을 순환시킵니다.",
        },
      ],
    },
  ],
  ml: [
    {
      id: "ml-chat-1",
      projectId: "ml",
      title: "정규화가 필요한 이유",
      updatedAt: "2026-04-08T14:15:00.000Z",
      messages: [
        {
          id: "ml-chat-1-user-1",
          role: "user",
          text: "머신러닝에서 정규화가 왜 필요한지 알려줘.",
        },
        {
          id: "ml-chat-1-assistant-1",
          role: "assistant",
          text: "특성 간 스케일 차이가 크면 최적화가 불안정해질 수 있어서 정규화를 사용합니다.",
        },
      ],
    },
  ],
  db: [
    {
      id: "db-chat-1",
      projectId: "db",
      title: "JOIN 종류 빠르게 복습",
      updatedAt: "2026-04-11T08:30:00.000Z",
      messages: [
        {
          id: "db-chat-1-user-1",
          role: "user",
          text: "INNER JOIN, LEFT JOIN, RIGHT JOIN 차이 알려줘.",
        },
        {
          id: "db-chat-1-assistant-1",
          role: "assistant",
          text: "INNER JOIN은 교집합, LEFT JOIN은 왼쪽 기준, RIGHT JOIN은 오른쪽 기준으로 데이터를 결합합니다.",
        },
      ],
    },
  ],
  network: [
    {
      id: "network-chat-1",
      projectId: "network",
      title: "TCP 3-way handshake 순서",
      updatedAt: "2026-04-07T07:45:00.000Z",
      messages: [
        {
          id: "network-chat-1-user-1",
          role: "user",
          text: "TCP 3-way handshake 과정을 단계별로 설명해줘.",
        },
        {
          id: "network-chat-1-assistant-1",
          role: "assistant",
          text: "클라이언트가 SYN, 서버가 SYN-ACK, 클라이언트가 ACK를 보내며 연결을 수립합니다.",
        },
      ],
    },
  ],
  "data-structures": [
    {
      id: "data-structures-chat-1",
      projectId: "data-structures",
      title: "스택과 큐 사용 사례",
      updatedAt: "2026-04-12T10:30:00.000Z",
      messages: [
        {
          id: "data-structures-chat-1-assistant-1",
          role: "assistant",
          text: "스택은 되돌리기, 함수 호출처럼 최근 항목을 먼저 처리할 때 쓰고 큐는 작업 대기열처럼 먼저 온 항목을 먼저 처리할 때 씁니다.",
        },
        {
          id: "data-structures-chat-1-user-1",
          role: "user",
          text: "스택과 큐는 언제 다르게 쓰는지 예시로 알려줘.",
        },
      ],
    },
  ],
  algorithm: [
    {
      id: "algorithm-chat-1",
      projectId: "algorithm",
      title: "BFS와 DFS 비교",
      updatedAt: "2026-04-13T13:00:00.000Z",
      messages: [
        {
          id: "algorithm-chat-1-user-1",
          role: "user",
          text: "BFS와 DFS의 차이를 짧게 비교해줘.",
        },
        {
          id: "algorithm-chat-1-assistant-1",
          role: "assistant",
          text: "BFS는 가까운 정점부터 넓게 탐색하고, DFS는 한 경로를 깊게 내려간 뒤 되돌아오는 방식입니다.",
        },
      ],
    },
  ],
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function canUseStorage() {
  return typeof window !== "undefined";
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
    return { chatsByProject: clone(DEFAULT_CHATS_BY_PROJECT) };
  }

  try {
    const raw = window.localStorage.getItem(DASHBOARD_CHAT_STORAGE_KEY);

    if (!raw) {
      const seed = { chatsByProject: clone(DEFAULT_CHATS_BY_PROJECT) };
      window.localStorage.setItem(DASHBOARD_CHAT_STORAGE_KEY, JSON.stringify(seed));
      return seed;
    }

    const parsed = JSON.parse(raw);

    return {
      chatsByProject: {
        ...clone(DEFAULT_CHATS_BY_PROJECT),
        ...(parsed?.chatsByProject || {}),
      },
    };
  } catch {
    return { chatsByProject: clone(DEFAULT_CHATS_BY_PROJECT) };
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

function buildStarterChat(projectId: string, projectTitle: string, index: number): Chat {
  const now = new Date().toISOString();
  const catalogEntry = (projectCatalog as Record<string, { chatMessages?: Chat["messages"] }>)[projectId];
  const catalogMessages = catalogEntry?.chatMessages || [];
  const fallbackQuestion = `${projectTitle}에서 먼저 정리해야 할 핵심 개념이 뭐야?`;

  return {
    id: `${projectId}-chat-${Date.now()}`,
    projectId,
    title: `새 대화 ${index}`,
    updatedAt: now,
    messages: catalogMessages.length
      ? clone(catalogMessages)
      : [
          {
            id: `${projectId}-chat-${Date.now()}-assistant-1`,
            role: "assistant",
            text: `${projectTitle} 프로젝트를 시작했어요. 먼저 궁금한 개념이나 목표를 짧게 적어보세요.`,
          },
          {
            id: `${projectId}-chat-${Date.now()}-user-1`,
            role: "user",
            text: fallbackQuestion,
          },
        ],
  };
}

export async function getProjects(): Promise<Project[]> {
  if (isBackendApiEnabled) {
    const userId = await getCurrentUserId();
    const projects = await apiRequest(`/projects/user/${encodeURIComponent(userId)}`, {
      method: "GET",
    });

    return Array.isArray(projects)
      ? projects.map(normalizeApiProject).sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
      : [];
  }

  const workspaceState = loadWorkspaceState();
  const chatStore = loadChatStore();

  return sortProjectsByUpdatedAt(workspaceState.projects, chatStore.chatsByProject);
}

export async function getProjectCatalogOptions(): Promise<ProjectCatalogOption[]> {
  return clone(MOCK_PROJECT_CATALOG);
}

export async function getProjectChats(projectId: string): Promise<Chat[]> {
  if (isBackendApiEnabled) {
    const projects = await getProjects();
    const projectTitle = projects.find((project) => project.id === projectId)?.title || `${projectId} 프로젝트`;
    const chats = await apiRequest(`/chat/project/${encodeURIComponent(projectId)}`, {
      method: "GET",
    });

    return [buildApiThread(projectId, projectTitle, Array.isArray(chats) ? chats : [])];
  }

  const chatStore = loadChatStore();
  return sortChatsByUpdatedAt(chatStore.chatsByProject[projectId] || []);
}

export async function selectProjectFromCatalog(projectId: string): Promise<Project> {
  const catalogProject = MOCK_PROJECT_CATALOG.find((project) => project.id === projectId);

  if (!catalogProject) {
    throw new Error("선택한 학습 프로젝트를 찾을 수 없습니다.");
  }

  if (isBackendApiEnabled) {
    const userId = await getCurrentUserId();
    const project = await apiRequest("/projects/", {
      method: "POST",
      body: {
        user_id: userId,
        project_name: catalogProject.title,
        project_description: catalogProject.description,
        project_domain: catalogProject.id,
      },
    });

    return normalizeApiProject(project);
  }

  const now = new Date().toISOString();
  const catalogEntry = (projectCatalog as Record<string, { materials?: unknown[] }>)[catalogProject.id];
  const nextProject = {
    id: catalogProject.id,
    title: catalogProject.title,
    updatedAt: now,
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

export async function createChat(projectId: string): Promise<Chat> {
  if (isBackendApiEnabled) {
    const projects = await getProjects();
    const project = projects.find((item) => item.id === projectId);

    if (!project) {
      throw new Error("선택한 프로젝트를 찾을 수 없습니다.");
    }

    return buildApiThread(projectId, project.title, []);
  }

  const projects = await getProjects();
  const project = projects.find((item) => item.id === projectId);

  if (!project) {
    throw new Error("선택한 프로젝트를 찾을 수 없습니다.");
  }

  const chatStore = loadChatStore();
  const existingChats = chatStore.chatsByProject[projectId] || [];
  const nextChat = buildStarterChat(projectId, project.title, existingChats.length + 1);

  chatStore.chatsByProject[projectId] = [nextChat, ...existingChats];
  saveChatStore(chatStore);
  persistProjectUpdatedAt(projectId, nextChat.updatedAt);

  return nextChat;
}

export async function sendChatMessage(projectId: string, message: string, responseType = "default") {
  if (!isBackendApiEnabled) {
    await delay(MOCK_CHAT_RESPONSE_DELAY_MS);
    throw new Error("백엔드 API 모드에서만 채팅 전송을 사용할 수 있습니다.");
  }

  const userId = await getCurrentUserId();

  return apiRequest(`/chat/${encodeURIComponent(projectId)}`, {
    method: "POST",
    body: {
      user_id: userId,
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

export async function createExplanation({
  projectId,
  nodeId = null,
  question,
}: {
  projectId: string;
  nodeId?: string | null;
  question: string;
}): Promise<string> {
  if (!isBackendApiEnabled) {
    return "";
  }

  const userId = await getCurrentUserId();
  const result = await apiRequest("/explanation", {
    method: "POST",
    body: {
      project_id: projectId,
      user_id: String(userId),
      node_id: nodeId,
      question,
    },
  });

  return typeof result?.response === "string" ? result.response : "";
}

export async function getProjectMemo(projectId: string): Promise<string> {
  if (isBackendApiEnabled) {
    const memo = await apiRequest(`/projects/${encodeURIComponent(projectId)}/memo`, {
      method: "GET",
    });

    return typeof memo?.content === "string" ? memo.content : "";
  }

  return getLocalProjectNote(loadWorkspaceState(), projectId);
}

export async function saveProjectMemo(projectId: string, content: string): Promise<string> {
  if (isBackendApiEnabled) {
    const memo = await apiRequest(`/projects/${encodeURIComponent(projectId)}/memo`, {
      method: "PATCH",
      body: {
        content,
      },
    });

    return typeof memo?.content === "string" ? memo.content : content;
  }

  const nextWorkspaceState = saveLocalProjectNote(loadWorkspaceState(), projectId, content);
  saveWorkspaceState(nextWorkspaceState);

  return content;
}
