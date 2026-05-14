export type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
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

export type DashboardChatStore = {
  chatsByProject: Record<string, Chat[]>;
};
