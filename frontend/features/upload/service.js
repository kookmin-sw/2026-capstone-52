import {
  hasMockCompletedAnalysis,
  listMockProjectFiles,
  startMockAnalysis,
  uploadMockFiles,
} from "./mock-service";
import {
  hasApiCompletedAnalysis,
  listApiProjectFiles,
  refreshApiAnalysisStatuses,
  startApiAnalysis,
  uploadApiFiles,
} from "./api-service";

export const isBackendApiEnabled = process.env.NEXT_PUBLIC_USE_BACKEND_API === "true";

export async function listProjectFiles(projectId) {
  if (isBackendApiEnabled) {
    return listApiProjectFiles(projectId);
  }

  return listMockProjectFiles(projectId);
}

export async function uploadProjectFiles(projectId, subject, files) {
  if (isBackendApiEnabled) {
    return uploadApiFiles(projectId, files);
  }

  return uploadMockFiles(projectId, subject, files);
}

export async function startAnalysis(projectId, fileIds) {
  if (isBackendApiEnabled) {
    await startApiAnalysis(fileIds);
    return listApiProjectFiles(projectId);
  }

  startMockAnalysis(projectId, fileIds);
  return listMockProjectFiles(projectId);
}

export async function refreshAnalysisStatuses(projectId, files) {
  if (isBackendApiEnabled) {
    return refreshApiAnalysisStatuses(files);
  }

  return listMockProjectFiles(projectId);
}

export async function hasCompletedAnalysis(projectId) {
  if (isBackendApiEnabled) {
    return hasApiCompletedAnalysis(projectId);
  }

  return hasMockCompletedAnalysis(projectId);
}
