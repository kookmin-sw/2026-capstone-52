import type { MyPageStats, ProfileInfo, RecentLearningRecord } from "@/types/profile";
import { apiRequest } from "@/features/api/client";
import { ensureCurrentUser, mapApiUserToProfile, updateCurrentUserProfile } from "@/features/api/session";

const isBackendApiEnabled = process.env.NEXT_PUBLIC_USE_BACKEND_API === "true";
const activityColors = ["#4ade80", "#60a5fa", "#fb923c", "#8b5cf6", "#f472b6", "#fb7185"];
const MY_PAGE_DETAIL_FETCH_LIMIT = 5;

type ApiProject = {
  project_id: number | string;
  project_name: string;
  project_domain?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  last_accessed_at?: string | null;
};

type ApiLearningLog = {
  activity_id: number | string;
  project_id?: number | string | null;
  activity_type: string;
  activity_summary: string;
  created_at?: string | null;
};

type ApiGraphNode = {
  node_id: string;
  project_id: number | string;
  name: string;
  group?: string | null;
  updated_at?: string | null;
};

function normalizeDate(value?: string | null) {
  if (!value) {
    return new Date().toISOString();
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function getProjectActivityTime(project: ApiProject) {
  const timestamp = project.last_accessed_at || project.updated_at || project.created_at;
  if (!timestamp) {
    return 0;
  }

  const time = Date.parse(timestamp);
  return Number.isNaN(time) ? 0 : time;
}

function buildRecentRecords(logs: ApiLearningLog[], graphNodes: ApiGraphNode[]): RecentLearningRecord[] {
  const graphRecords = graphNodes.map((node, index) => ({
    id: node.node_id,
    projectId: String(node.project_id),
    subject: node.group || "지식 그래프",
    nodeName: node.name,
    updatedAt: normalizeDate(node.updated_at),
    accentColor: activityColors[index % activityColors.length],
  }));
  const logRecords = logs.map((log, index) => ({
    id: String(log.activity_id),
    projectId: String(log.project_id || "activity"),
    subject: log.activity_type,
    nodeName: log.activity_summary,
    updatedAt: normalizeDate(log.created_at),
    accentColor: activityColors[(index + graphRecords.length) % activityColors.length],
  }));

  return [...graphRecords, ...logRecords]
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
    .slice(0, 6);
}

export async function getApiMyPageViewData(): Promise<{
  profile: ProfileInfo;
  profileImage: string | null;
  stats: MyPageStats;
  recentRecords: RecentLearningRecord[];
} | null> {
  if (!isBackendApiEnabled) {
    return null;
  }

  const user = await ensureCurrentUser();
  const [mypage, projects, logs] = await Promise.all([
    apiRequest("/mypage/me", { method: "GET" }).catch(() => null),
    apiRequest("/projects/me", { method: "GET" }),
    apiRequest("/learning-logs/me", { method: "GET" }).catch(() => []),
  ]);
  const safeProjects = Array.isArray(projects) ? (projects as ApiProject[]) : [];
  const safeLogs = Array.isArray(logs) ? (logs as ApiLearningLog[]) : [];
  const projectsForDetailStats = safeProjects
    .slice()
    .sort((left, right) => getProjectActivityTime(right) - getProjectActivityTime(left))
    .slice(0, MY_PAGE_DETAIL_FETCH_LIMIT);
  // 백엔드에 전체 concept/chat 집계 필드가 없어 최근 프로젝트만 조회해 마이페이지 N+1 비용을 제한한다.
  const graphs = await Promise.all(
    projectsForDetailStats.map((project) =>
      apiRequest(`/graph/${encodeURIComponent(project.project_id)}`, { method: "GET" }).catch(() => null)
    )
  );
  const graphNodes = graphs.flatMap((graph) => (Array.isArray(graph?.nodes) ? (graph.nodes as ApiGraphNode[]) : []));
  const chatCounts = await Promise.all(
    projectsForDetailStats.map((project) =>
      apiRequest(`/chat/project/${encodeURIComponent(project.project_id)}`, { method: "GET" })
        .then((chats) => (Array.isArray(chats) ? chats.length : 0))
        .catch(() => 0)
    )
  );

  return {
    profile: mapApiUserToProfile(mypage?.user || user),
    profileImage: (mypage?.user || user)?.profile_image || null,
    stats: {
      projectCount: mypage?.summary?.project_count ?? safeProjects.length,
      totalChats: chatCounts.reduce((sum, count) => sum + count, 0),
      diagnosisCount: safeLogs.filter((log) => log.activity_type === "diagnosis_completed").length,
      conceptCount: graphNodes.length,
      detailStatsLimit: MY_PAGE_DETAIL_FETCH_LIMIT,
      detailStatsAreCapped: safeProjects.length > projectsForDetailStats.length,
    },
    recentRecords: buildRecentRecords(safeLogs, graphNodes),
  };
}

export async function saveApiProfile(
  profile: ProfileInfo,
  profileImage: string | null,
  options: { includeProfileImage?: boolean } = {}
) {
  if (!isBackendApiEnabled) {
    return profile;
  }

  await updateCurrentUserProfile(profile, profileImage, options);
  return profile;
}
