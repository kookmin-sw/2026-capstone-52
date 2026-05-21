export type MiniQuizReadyConcept = {
  nodeId: string;
  name: string;
};

export type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
  variant?: "diagnosis-report" | "mini-quiz-result";
  collapsible?: boolean;
  attachment?: {
    type: "graph-preview";
  };
  miniQuizReady?: MiniQuizReadyConcept[];
};

export type Chat = {
  // Backend mode uses `${projectId}-session-${sessionId}` so URL chatId can stay string-safe.
  id: string;
  projectId: string;
  title: string;
  updatedAt: string;
  messages: ChatMessage[];
};

export type ChatSession = {
  id: number;
  project_id: number;
  title: string;
  created_at: string;
  updated_at: string;
};

export type Project = {
  id: string;
  title: string;
  updatedAt: string;
  domain?: string | null;
};

export type ProjectCatalogOption = {
  id: string;
  title: string;
  description: string;
  domain: string;
  level: string;
  estimatedTime: string;
};

export type ProjectMemo = {
  memoId: string;
  projectId: string;
  title: string;
  content: string;
  createdAt: string | null;
  updatedAt: string | null;
};

export type DashboardChatStore = {
  version: number;
  chatsByProject: Record<string, Chat[]>;
};
