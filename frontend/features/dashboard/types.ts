export type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
  variant?: "diagnosis-report";
  attachment?: {
    type: "graph-preview";
  };
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
  chatsByProject: Record<string, Chat[]>;
};
