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
  id: string;
  projectId: string;
  title: string;
  updatedAt: string;
  messages: ChatMessage[];
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
