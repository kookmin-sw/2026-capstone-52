import { apiRequest } from "../api/client";

export const isDiagnosisBackendApiEnabled = process.env.NEXT_PUBLIC_USE_BACKEND_API === "true";

export async function createApiDiagnosisSession(projectId) {
  return apiRequest(`/diagnosis/${encodeURIComponent(projectId)}/sessions`, {
    method: "POST",
  });
}

export async function createApiDiagnosisQuestion(projectId, sessionId) {
  const query = sessionId ? `?session_id=${encodeURIComponent(sessionId)}` : "";
  return apiRequest(`/diagnosis/${encodeURIComponent(projectId)}/questions${query}`, {
    method: "POST",
  });
}

export async function submitApiDiagnosisAnswer(
  projectId,
  sessionId,
  questionId,
  { selectedOptionIds = null, isSkipped = false } = {}
) {
  const body = {
    question_id: questionId,
    session_id: sessionId,
    is_skipped: isSkipped,
  };

  if (Array.isArray(selectedOptionIds) && selectedOptionIds.length > 0) {
    body.selected_option_ids = selectedOptionIds;
  }

  return apiRequest(`/diagnosis/${encodeURIComponent(projectId)}/answers`, {
    method: "POST",
    body,
  });
}

export async function getApiDiagnosisStatus(projectId, sessionId) {
  const query = sessionId ? `?session_id=${encodeURIComponent(sessionId)}` : "";

  return apiRequest(`/diagnosis/${encodeURIComponent(projectId)}/status${query}`, {
    method: "GET",
  });
}

export async function createApiDiagnosisReport(projectId, sessionId) {
  return apiRequest(`/diagnosis/${encodeURIComponent(projectId)}/report`, {
    method: "POST",
    body: { session_id: sessionId },
  });
}

export async function getApiDiagnosisNodes(projectId, questionId = null) {
  const query = questionId ? `?question_id=${encodeURIComponent(questionId)}` : "";
  return apiRequest(`/diagnosis/${encodeURIComponent(projectId)}/nodes${query}`, {
    method: "GET",
  });
}

export async function getApiDiagnosisReview(projectId, sessionId) {
  return apiRequest(
    `/diagnosis/${encodeURIComponent(projectId)}/sessions/${encodeURIComponent(sessionId)}/review`,
    { method: "GET" }
  );
}

export async function getApiProjectGraph(projectId) {
  return apiRequest(`/graph/${encodeURIComponent(projectId)}`, {
    method: "GET",
  });
}
