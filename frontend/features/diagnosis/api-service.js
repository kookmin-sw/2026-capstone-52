import { apiRequest } from "../api/client";

export const isDiagnosisBackendApiEnabled = process.env.NEXT_PUBLIC_USE_BACKEND_API === "true";

export async function createApiDiagnosisSession(projectId) {
  return apiRequest(`/diagnosis/${encodeURIComponent(projectId)}/sessions`, {
    method: "POST",
  });
}

export async function createApiDiagnosisQuestion(projectId) {
  return apiRequest(`/diagnosis/${encodeURIComponent(projectId)}/questions`, {
    method: "POST",
  });
}

export async function submitApiDiagnosisAnswer(projectId, sessionId, questionId, selectedIndex, isSkipped = false) {
  return apiRequest(`/diagnosis/${encodeURIComponent(projectId)}/answers`, {
    method: "POST",
    body: {
      question_id: questionId,
      session_id: sessionId,
      selected_index: selectedIndex,
      is_skipped: isSkipped,
    },
  });
}

export async function getApiDiagnosisStatus(projectId, sessionId) {
  const query = sessionId ? `?session_id=${encodeURIComponent(sessionId)}` : "";

  return apiRequest(`/diagnosis/${encodeURIComponent(projectId)}/status${query}`, {
    method: "GET",
  });
}

export async function getApiProjectGraph(projectId) {
  return apiRequest(`/graph/${encodeURIComponent(projectId)}`, {
    method: "GET",
  });
}
