import { apiRequest } from "../api/client";

const isBackendApiEnabled = process.env.NEXT_PUBLIC_USE_BACKEND_API === "true";

export async function createLearningLog({ projectId = null, activityType, activitySummary }) {
  if (!isBackendApiEnabled) {
    return null;
  }

  return apiRequest("/learning-logs/", {
    method: "POST",
    body: {
      project_id: projectId ? Number(projectId) : null,
      activity_type: activityType,
      activity_summary: activitySummary,
    },
  });
}
