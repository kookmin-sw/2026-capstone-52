const WORKSPACE_STORAGE_KEY = "eeum-workspace-v1";
const PROJECT_DIAGNOSIS_KEY = "__project__";

const defaultWorkspaceState = {
  projects: [
    { id: "calculus", title: "미적분 복습 프로젝트", updatedAt: "최근 질문 12개" },
    { id: "os", title: "운영체제 개념 정리", updatedAt: "최근 질문 8개" },
    { id: "ml", title: "머신러닝 수학 기초", updatedAt: "최근 질문 5개" },
    { id: "db", title: "데이터베이스 SQL 학습", updatedAt: "최근 질문 9개" },
    { id: "network", title: "네트워크 면접 대비", updatedAt: "최근 질문 3개" }
  ],
  materialsByProject: {
    calculus: [
      { id: "doc-1", name: "미적분_1장_정리.pdf", status: "수준진단 대기" },
      { id: "doc-2", name: "접선과_미분계수.pdf", status: "그냥 진행 가능" },
      { id: "doc-3", name: "연습문제_풀이.pdf", status: "진단 완료" }
    ],
    os: [],
    ml: [],
    db: [],
    network: []
  },
  diagnosisByProject: {},
  notesByProject: {},
  lastOpenedProjectId: "calculus"
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function getDefaultWorkspaceState() {
  return clone(defaultWorkspaceState);
}

function canUseStorage() {
  return typeof window !== "undefined";
}

export function loadWorkspaceState() {
  if (!canUseStorage()) {
    return getDefaultWorkspaceState();
  }

  try {
    const raw = window.localStorage.getItem(WORKSPACE_STORAGE_KEY);

    if (!raw) {
      return getDefaultWorkspaceState();
    }

    const parsed = JSON.parse(raw);

    return {
      projects: Array.isArray(parsed.projects) ? parsed.projects : clone(defaultWorkspaceState.projects),
      materialsByProject: {
        ...clone(defaultWorkspaceState.materialsByProject),
        ...(parsed.materialsByProject || {})
      },
      diagnosisByProject: parsed.diagnosisByProject || {},
      notesByProject: parsed.notesByProject || {},
      lastOpenedProjectId:
        typeof parsed.lastOpenedProjectId === "string"
          ? parsed.lastOpenedProjectId
          : defaultWorkspaceState.lastOpenedProjectId
    };
  } catch {
    return getDefaultWorkspaceState();
  }
}

export function saveWorkspaceState(state) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(state));
}

export function createProjectRecord(title) {
  const trimmedTitle = title.trim();
  const slug = trimmedTitle
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");

  return {
    id: slug || `project-${Date.now()}`,
    title: trimmedTitle,
    updatedAt: "방금 생성됨"
  };
}

export function upsertProjectState(state, project) {
  const nextProjects = state.projects.some((item) => item.id === project.id)
    ? state.projects.map((item) => (item.id === project.id ? { ...item, ...project } : item))
    : [project, ...state.projects];

  return {
    ...state,
    projects: nextProjects,
    lastOpenedProjectId: project.id,
    materialsByProject: {
      ...state.materialsByProject,
      [project.id]: state.materialsByProject[project.id] || []
    }
  };
}

export function updateProjectMaterials(state, projectId, materials) {
  return {
    ...state,
    materialsByProject: {
      ...state.materialsByProject,
      [projectId]: materials
    }
  };
}

export function saveDiagnosisSummary(state, projectId, materialId, payload) {
  const nextMaterials = (state.materialsByProject[projectId] || []).map((material) =>
    material.id === materialId
      ? {
          ...material,
          status: "진단 완료"
        }
      : material
  );

  return {
    ...state,
    materialsByProject: {
      ...state.materialsByProject,
      [projectId]: nextMaterials
    },
    diagnosisByProject: {
      ...state.diagnosisByProject,
      [projectId]: {
        ...(state.diagnosisByProject[projectId] || {}),
        [materialId]: payload
      }
    }
  };
}

export function getDiagnosisSummary(state, projectId, materialId) {
  return state.diagnosisByProject?.[projectId]?.[materialId] || null;
}

export function saveProjectDiagnosis(state, projectId, payload) {
  const nextMaterials = (state.materialsByProject[projectId] || []).map((material) => ({
    ...material,
    status: "진단 완료",
  }));

  return {
    ...state,
    materialsByProject: {
      ...state.materialsByProject,
      [projectId]: nextMaterials,
    },
    diagnosisByProject: {
      ...state.diagnosisByProject,
      [projectId]: {
        ...(state.diagnosisByProject[projectId] || {}),
        [PROJECT_DIAGNOSIS_KEY]: payload,
      },
    },
  };
}

export function getProjectDiagnosis(state, projectId) {
  return state.diagnosisByProject?.[projectId]?.[PROJECT_DIAGNOSIS_KEY] || null;
}

export function getLastOpenedProjectId(state) {
  if (!state.projects.length) {
    return null;
  }

  return state.lastOpenedProjectId || state.projects[0].id;
}

export function setLastOpenedProject(state, projectId) {
  return {
    ...state,
    lastOpenedProjectId: projectId
  };
}

export function getProjectNote(state, projectId) {
  return state.notesByProject?.[projectId] || "";
}

export function saveProjectNote(state, projectId, note) {
  return {
    ...state,
    notesByProject: {
      ...state.notesByProject,
      [projectId]: note
    }
  };
}
