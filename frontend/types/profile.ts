export type ExplanationStyleId = "example" | "step" | "concise" | "deep";

export type LearningTypeId = "exam" | "concept" | "project" | "light";

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
  description: string;
}

export interface ProfileInfo {
  name: string;
  language: string;
  job: string;
  major: string;
  explanationStyle: ExplanationStyleId;
  learningType: LearningTypeId;
  learningGoal: string;
}

export interface StoredProfileState {
  profile: ProfileInfo;
  profileImage: string | null;
}

export interface ProfileBadge {
  label: string;
  value: string;
}

export interface MyPageProject {
  id: string;
  title: string;
  category: string;
}

export interface ProjectChatSummary {
  projectId: string;
  totalChats: number;
}

export interface DiagnosisSession {
  id: string;
  createdAt: string;
}

export interface GraphNodeRecord {
  id: string;
  projectId: string;
  name: string;
  category: string;
  updatedAt: string;
  color: string;
  x: number;
  y: number;
  size: number;
}

export interface RecentLearningRecord {
  id: string;
  projectId: string;
  subject: string;
  nodeName: string;
  updatedAt: string;
  accentColor: string;
}

export interface MyPageStats {
  projectCount: number;
  totalChats: number;
  diagnosisCount: number | string;
  conceptCount: number;
  detailStatsLimit?: number;
  detailStatsAreCapped?: boolean;
}
