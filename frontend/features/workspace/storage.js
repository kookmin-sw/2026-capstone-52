const WORKSPACE_STORAGE_KEY = "eeum-workspace-v1";
const PROJECT_DIAGNOSIS_KEY = "__project__";

const defaultWorkspaceState = {
  projects: [],
  materialsByProject: {
    calculus: [
      { id: "doc-1", name: "미적분_1장_정리.pdf", status: "수준진단 대기" },
      { id: "doc-2", name: "접선과_미분계수.pdf", status: "그냥 진행 가능" },
      { id: "doc-3", name: "연습문제_풀이.pdf", status: "진단 완료" }
    ],
    os: [
      { id: "os-doc-1", name: "프로세스와_스레드.pdf", status: "수준진단 대기" },
      { id: "os-doc-2", name: "CPU_스케줄링_정리.pdf", status: "그냥 진행 가능" }
    ],
    "data-structures": [
      { id: "ds-doc-1", name: "스택_큐_트리_요약.pdf", status: "수준진단 대기" },
      { id: "ds-doc-2", name: "그래프_탐색_개념.pdf", status: "그냥 진행 가능" }
    ],
    network: [
      { id: "network-doc-1", name: "TCP_IP_핵심.pdf", status: "수준진단 대기" },
      { id: "network-doc-2", name: "라우팅과_혼잡제어.pdf", status: "그냥 진행 가능" }
    ],
    algorithm: [
      { id: "algo-doc-1", name: "정렬과_탐색_기초.pdf", status: "수준진단 대기" },
      { id: "algo-doc-2", name: "동적계획법_입문.pdf", status: "그냥 진행 가능" }
    ]
  },
  diagnosisByProject: {},
  notesByProject: {},
  lastOpenedProjectId: null
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
