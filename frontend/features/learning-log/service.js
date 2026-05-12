import { apiRequest } from "../api/client";
import { getCurrentUserId } from "../api/session";

const isBackendApiEnabled = process.env.NEXT_PUBLIC_USE_BACKEND_API === "true";

export async function createLearningLog({ projectId = null, activityType, activitySummary }) {
  if (!isBackendApiEnabled) {
    return null;
  }

  const userId = await getCurrentUserId();

  return apiRequest("/learning-logs/", {
    method: "POST",
    body: {
      user_id: userId,
      project_id: projectId ? Number(projectId) : null,
      activity_type: activityType,
      activity_summary: activitySummary,
    },
  });
}
