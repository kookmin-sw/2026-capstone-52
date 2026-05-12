import { apiRequest } from "../api/client";

export const isDiagnosisBackendApiEnabled = process.env.NEXT_PUBLIC_USE_BACKEND_API === "true";

export async function createApiDiagnosisQuestion(projectId) {
  return apiRequest(`/diagnosis/${encodeURIComponent(projectId)}/questions`, {
    method: "POST",
  });
}

export async function submitApiDiagnosisAnswer(projectId, diagnosisId, selectedIndex) {
  return apiRequest(`/diagnosis/${encodeURIComponent(projectId)}/answers`, {
    method: "POST",
    body: {
      diagnosis_id: diagnosisId,
      selected_index: selectedIndex,
    },
  });
}

export async function getApiDiagnosisStatus(projectId) {
  return apiRequest(`/diagnosis/${encodeURIComponent(projectId)}/status`, {
    method: "GET",
  });
}

export async function getApiProjectGraph(projectId) {
  return apiRequest(`/graph/${encodeURIComponent(projectId)}`, {
    method: "GET",
  });
}
