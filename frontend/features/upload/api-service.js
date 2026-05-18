import { apiRequest } from "../api/client";

const STATUS_LABELS = {
  UPLOADED: { status: "대기 중", statusTone: "idle" },
  PROCESSING: { status: "분석 중", statusTone: "working" },
  DONE: { status: "분석 완료", statusTone: "done" },
  FAILED: { status: "분석 실패", statusTone: "error" },
  REJECTED: { status: "분석 제외", statusTone: "rejected" },
};

function formatUploadedAt(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");

  return `${yyyy}.${mm}.${dd} ${hh}:${min}`;
}

function normalizeApiFile(file, projectTitle = "") {
  const statusInfo = STATUS_LABELS[file.analysis_status] || STATUS_LABELS.UPLOADED;

  return {
    id: file.file_id,
    name: file.file_name,
    subject: projectTitle || file.project_title || file.project_name || "프로젝트",
    uploadedAt: formatUploadedAt(file.uploaded_at),
    status: statusInfo.status,
    statusTone: statusInfo.statusTone,
    rawStatus: file.analysis_status,
  };
}

function getUploadedAtTime(file) {
  const time = new Date(file?.uploaded_at || 0).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function sortApiFilesByRecentUpload(files) {
  return [...files].sort((left, right) => {
    const uploadedAtDiff = getUploadedAtTime(right) - getUploadedAtTime(left);

    if (uploadedAtDiff !== 0) {
      return uploadedAtDiff;
    }

    return String(right?.file_id || "").localeCompare(String(left?.file_id || ""));
  });
}

function applyStatus(file, rawStatus) {
  const statusInfo = STATUS_LABELS[rawStatus] || STATUS_LABELS.UPLOADED;

  return {
    ...file,
    status: statusInfo.status,
    statusTone: statusInfo.statusTone,
    rawStatus,
  };
}

export async function listApiProjectFiles(projectId, projectTitle = "") {
  const files = await apiRequest(`/upload/${encodeURIComponent(projectId)}`, {
    method: "GET",
  });

  return Array.isArray(files)
    ? sortApiFilesByRecentUpload(files).map((file) => normalizeApiFile(file, projectTitle))
    : [];
}

export async function uploadApiFiles(projectId, files, projectTitle = "") {
  const uploadedFiles = [];

  for (const file of files) {
    const formData = new FormData();
    formData.append("file", file);

    const uploadedFile = await apiRequest(`/upload/${encodeURIComponent(projectId)}`, {
      method: "POST",
      body: formData,
    });

    uploadedFiles.push(normalizeApiFile(uploadedFile, projectTitle));
  }

  return uploadedFiles;
}

export async function startApiAnalysis(fileIds) {
  await Promise.all(
    fileIds.map((fileId) =>
      apiRequest(`/upload/${encodeURIComponent(fileId)}/analyze`, {
        method: "POST",
      })
    )
  );
}

export async function getApiAnalysisStatus(fileId) {
  const result = await apiRequest(`/upload/${encodeURIComponent(fileId)}/status`, {
    method: "GET",
  });

  return typeof result?.status === "string" ? result.status : "UPLOADED";
}

export async function refreshApiAnalysisStatuses(files) {
  const statusEntries = await Promise.all(
    files.map(async (file) => {
      if (file.rawStatus === "DONE" || file.rawStatus === "FAILED" || file.rawStatus === "REJECTED") {
        return [file.id, file.rawStatus];
      }

      return [file.id, await getApiAnalysisStatus(file.id)];
    })
  );
  const statusByFileId = new Map(statusEntries);

  return files.map((file) => applyStatus(file, statusByFileId.get(file.id) || file.rawStatus || "UPLOADED"));
}

export async function hasApiCompletedAnalysis(projectId) {
  const files = await listApiProjectFiles(projectId);
  return files.some((file) => file.rawStatus === "DONE" || file.statusTone === "done");
}
