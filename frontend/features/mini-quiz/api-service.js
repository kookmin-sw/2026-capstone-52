import { apiRequest } from "../api/client";

export const isMiniQuizBackendApiEnabled = process.env.NEXT_PUBLIC_USE_BACKEND_API === "true";

export async function generateApiMiniQuizQuestion(projectId, nodeId) {
  const query = `?node_id=${encodeURIComponent(nodeId)}`;
  return apiRequest(`/mini-quiz/${encodeURIComponent(projectId)}/generate${query}`, {
    method: "POST",
  });
}

export async function submitApiMiniQuizAnswer(
  projectId,
  questionId,
  { selectedOptionIds = null, isSkipped = false } = {}
) {
  const body = {
    question_id: questionId,
    is_skipped: isSkipped,
  };

  if (Array.isArray(selectedOptionIds) && selectedOptionIds.length > 0) {
    body.selected_option_ids = selectedOptionIds;
  }

  return apiRequest(`/mini-quiz/${encodeURIComponent(projectId)}/submit`, {
    method: "POST",
    body,
  });
}

export async function getApiMiniQuizReview(projectId, questionIds) {
  if (!questionIds?.length) {
    return [];
  }
  const query = `?question_ids=${questionIds.map(encodeURIComponent).join(",")}`;
  return apiRequest(`/mini-quiz/${encodeURIComponent(projectId)}/review${query}`, {
    method: "GET",
  });
}
