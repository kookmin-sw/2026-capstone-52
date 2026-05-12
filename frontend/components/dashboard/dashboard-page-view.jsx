"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import KnowledgeGraphScene from "../graph/knowledge-graph-scene";
import EeumIcon from "@/components/common/EeumIcon";
import { buildBackendKnowledgeGraph, buildProjectKnowledgeGraph } from "../../features/dashboard/graph";
import {
  getDefaultWorkspaceState,
  getDiagnosisSummary,
  getProjectDiagnosis,
  loadWorkspaceState,
  saveWorkspaceState,
} from "../../features/workspace/storage";
import {
  createChat,
  createExplanation,
  getGraphNodeDetail,
  getProjectCatalogOptions,
  getProjectMemo,
  getProjectGraphData,
  getProjectChats,
  getProjects,
  getRecentGraphNodes,
  saveProjectMemo,
  selectProjectFromCatalog,
  sendChatMessage,
} from "../../features/dashboard/service";
import { getProjectData } from "../../features/project/model";
import WorkspaceProfileCard from "./WorkspaceProfileCard";
import ProfileAvatar from "@/components/profile/ProfileAvatar";
import { getDashboardProfileSummary, useProfileStore } from "@/store/profileStore";

function ProjectCatalogModal({
  options,
  selectedOptionId,
  selectedCatalogOptionIds,
  onSelectOption,
  onClose,
  onConfirm,
  isCreating,
  errorMessage,
}) {
  const availableOptions = options.filter((option) => !selectedCatalogOptionIds.includes(option.id));
  const selectedOption =
    availableOptions.find((option) => option.id === selectedOptionId) || availableOptions[0] || null;

  return (
    <div className="workspace-modal-backdrop" onClick={onClose}>
      <form
        className="workspace-modal-panel workspace-catalog-modal-panel"
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          if (selectedOption) {
            onConfirm(selectedOption.id);
          }
        }}
      >
        <p className="workspace-modal-eyebrow">Subject Catalog</p>
        <h2 className="workspace-modal-title">학습할 교과목을 선택합니다</h2>
        <p className="workspace-modal-copy">선택한 교과목 이름으로 프로젝트가 생성됩니다.</p>

        <div className="workspace-catalog-list" role="radiogroup" aria-label="학습 교과목 선택">
          {options.map((option) => {
            const isAlreadySelected = selectedCatalogOptionIds.includes(option.id);
            const isSelected = selectedOption?.id === option.id;

            return (
              <button
                key={option.id}
                type="button"
                className={`workspace-catalog-item ${isSelected ? "workspace-catalog-item-active" : ""}`}
                onClick={() => onSelectOption(option.id)}
                disabled={isAlreadySelected}
                role="radio"
                aria-checked={isSelected}
              >
                <strong>{option.title}</strong>
              </button>
            );
          })}
          {!options.length ? <p className="workspace-catalog-empty">선택 가능한 교과목을 불러오는 중입니다.</p> : null}
          {options.length && !availableOptions.length ? (
            <p className="workspace-catalog-empty">모든 교과목이 이미 선택되었습니다.</p>
          ) : null}
        </div>

        {errorMessage ? <p className="workspace-modal-error">{errorMessage}</p> : null}

        <div className="workspace-modal-actions">
          <button type="button" className="workspace-secondary-button" onClick={onClose} disabled={isCreating}>
            취소
          </button>
          <button
            type="submit"
            className="workspace-primary-button"
            disabled={!selectedOption || isCreating}
          >
            {isCreating ? "생성 중..." : "생성"}
          </button>
        </div>
      </form>
    </div>
  );
}

function buildUpdatedConcepts(projectData, workspaceState, graphNodes = []) {
  const diagnosisEntries = (projectData.materials || [])
    .map((material) => getDiagnosisSummary(workspaceState, projectData.projectId, material.id))
    .filter(Boolean);
  const projectDiagnosis = getProjectDiagnosis(workspaceState, projectData.projectId);
  const mergedDiagnosisEntries = projectDiagnosis ? [...diagnosisEntries, projectDiagnosis] : diagnosisEntries;

  const diagnosisConcepts = mergedDiagnosisEntries.flatMap((entry) => entry.assessment?.missingConcepts || []);
  const graphConcepts = graphNodes
    .filter((node) => node.kind === "concept")
    .map((node) => node.label);
  const merged = [...graphConcepts, ...diagnosisConcepts];

  return [...new Set(merged)].slice(0, 3);
}

function SearchIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path
        d="M10.75 4.75a6 6 0 1 0 0 12a6 6 0 0 0 0-12Zm-8 6a8 8 0 1 1 13.77 5.51l4.98 4.97l-1.41 1.42l-4.98-4.98A8 8 0 0 1 2.75 10.75Z"
        fill="currentColor"
      />
    </svg>
  );
}

function ResetIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path
        d="M12 5a7 7 0 1 1-6.4 9.84l1.84-.79A5 5 0 1 0 12 7h-.18l1.93 1.93l-1.41 1.41L7.99 6l4.35-4.35l1.41 1.41L11.82 5H12Z"
        fill="currentColor"
      />
    </svg>
  );
}

const CATALOG_OPTION_ID_BY_PROJECT_DOMAIN = {
  operating_system: "os",
  data_structure: "data-structures",
  computer_network: "network",
  algorithm: "algorithm",
  os: "os",
  "data-structures": "data-structures",
  network: "network",
};

function getSelectedCatalogOptionIds(projects) {
  return projects.map((project) => CATALOG_OPTION_ID_BY_PROJECT_DOMAIN[project.domain] || project.id);
}

function formatUpdatedAt(isoString) {
  if (!isoString || Number.isNaN(Date.parse(isoString))) {
    return "방금 업데이트";
  }

  const diffMs = Date.now() - Date.parse(isoString);
  const diffMinutes = Math.max(1, Math.floor(diffMs / 60000));

  if (diffMinutes < 60) {
    return `${diffMinutes}분 전`;
  }

  const diffHours = Math.floor(diffMinutes / 60);

  if (diffHours < 24) {
    return `${diffHours}시간 전`;
  }

  const diffDays = Math.floor(diffHours / 24);

  if (diffDays < 7) {
    return `${diffDays}일 전`;
  }

  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
  }).format(new Date(isoString));
}

function ProjectSelector({
  projects,
  selectedProjectId,
  isExpanded,
  onToggle,
  onSelect,
  isLoading,
  error
}) {
  const selectedProject = projects.find((project) => project.id === selectedProjectId) || null;
  const visibleProjects = isExpanded ? projects : selectedProject ? [selectedProject] : [];

  return (
    <section className="workspace-sidebar-group workspace-project-selector">
      <div className="workspace-sidebar-heading">
        <span>프로젝트</span>
        <button
          type="button"
          className={`workspace-sidebar-heading-button workspace-sidebar-heading-chevron ${
            isExpanded ? "workspace-sidebar-heading-chevron-open" : ""
          }`}
          onClick={onToggle}
          disabled={!projects.length}
          aria-label={isExpanded ? "프로젝트 목록 접기" : "프로젝트 목록 펼치기"}
        >
          ⌄
        </button>
      </div>

      {isLoading ? <div className="workspace-empty-copy">프로젝트를 불러오는 중입니다.</div> : null}
      {error ? <div className="workspace-empty-copy">{error}</div> : null}
      {!isLoading && !error && !selectedProject ? <div className="workspace-empty-copy">프로젝트가 없습니다.</div> : null}

      {!isLoading && !error && visibleProjects.length ? (
        <div className={`workspace-sidebar-section-scroll workspace-project-list ${
          isExpanded ? "workspace-project-list-open" : ""
        }`}>
          {visibleProjects.map((project) => (
            <button
              key={project.id}
              type="button"
              className={`workspace-project-item workspace-project-item-${project.id} ${
                selectedProjectId === project.id ? "workspace-project-item-active" : ""
              }`}
              onClick={() => onSelect(project.id)}
            >
              <em />
              <span className="workspace-project-item-copy">
                <strong>{project.title}</strong>
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function RecentChatList({
  chats,
  selectedChatId,
  onSelect,
  onCreateChat,
  canCreateChat,
  isLoading,
  error,
  selectedProjectTitle
}) {
  return (
    <section className="workspace-sidebar-group workspace-sidebar-group-fill">
      <div className="workspace-sidebar-heading">
        <span>최근 채팅</span>
      </div>
      <div className="workspace-sidebar-section-scroll workspace-chat-shortcuts">
        {isLoading ? <div className="workspace-empty-copy">채팅 목록을 불러오는 중입니다.</div> : null}
        {error ? <div className="workspace-empty-copy">{error}</div> : null}
        {!isLoading && !error && !selectedProjectTitle ? (
          <div className="workspace-empty-copy">프로젝트를 먼저 선택해주세요.</div>
        ) : null}
        {!isLoading && !error && selectedProjectTitle && !chats.length ? (
          <div className="workspace-empty-copy">이 프로젝트에는 최근 채팅이 없습니다.</div>
        ) : null}
        {!isLoading && !error
          ? chats.map((chat) => (
              <button
                key={chat.id}
                type="button"
                className={`workspace-chat-shortcut ${
                  selectedChatId === chat.id ? "workspace-chat-shortcut-active" : ""
                }`}
                onClick={() => onSelect(chat.id)}
              >
                <span className="workspace-chat-shortcut-title">{chat.title}</span>
                <small className="workspace-chat-shortcut-meta">{formatUpdatedAt(chat.updatedAt)}</small>
              </button>
            ))
          : null}
      </div>
      <button
        type="button"
        className="workspace-new-chat-button workspace-new-chat-button-inline"
        onClick={onCreateChat}
        disabled={!canCreateChat}
      >
        + 새 채팅
      </button>
    </section>
  );
}

export default function DashboardPageView({ initialProjectId = null, initialChatId = null }) {
  const chatLogRef = useRef(null);
  const graphSearchInputRef = useRef(null);
  const composerFileInputRef = useRef(null);
  const hasAppliedInitialChatRef = useRef(false);
  const latestProjectNoteRef = useRef("");
  const router = useRouter();
  const pathname = usePathname();
  const [workspaceState, setWorkspaceState] = useState(() => getDefaultWorkspaceState());
  const [projects, setProjects] = useState([]);
  const [recentChats, setRecentChats] = useState([]);
  const [backendGraph, setBackendGraph] = useState(null);
  const [recentGraphNodes, setRecentGraphNodes] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(() => initialProjectId || null);
  const [selectedChatId, setSelectedChatId] = useState(() => initialChatId || null);
  const [isProjectListExpanded, setIsProjectListExpanded] = useState(false);
  const [projectError, setProjectError] = useState(null);
  const [chatError, setChatError] = useState(null);
  const [isProjectsLoading, setIsProjectsLoading] = useState(true);
  const [isChatsLoading, setIsChatsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("chat");
  const [selectedUpdatedConceptLabel, setSelectedUpdatedConceptLabel] = useState(null);
  const [catalogOptions, setCatalogOptions] = useState([]);
  const [selectedCatalogOptionId, setSelectedCatalogOptionId] = useState(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [hasHydrated, setHasHydrated] = useState(false);
  const [selectedGraphNodeId, setSelectedGraphNodeId] = useState(null);
  const [graphDetailNodeId, setGraphDetailNodeId] = useState(null);
  const [visibleGraphDetailNodeId, setVisibleGraphDetailNodeId] = useState(null);
  const [graphFocusNodeId, setGraphFocusNodeId] = useState(null);
  const [graphResetKey, setGraphResetKey] = useState(0);
  const [isGraphSearchOpen, setIsGraphSearchOpen] = useState(false);
  const [graphSearchQuery, setGraphSearchQuery] = useState("");
  const [composerText, setComposerText] = useState("");
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [projectNote, setProjectNote] = useState("");
  const [projectNoteProjectId, setProjectNoteProjectId] = useState(null);
  const [isProjectNoteDirty, setIsProjectNoteDirty] = useState(false);
  const [isProjectNoteSaving, setIsProjectNoteSaving] = useState(false);
  const [projectNoteError, setProjectNoteError] = useState(null);
  const [graphNodeDetail, setGraphNodeDetail] = useState(null);
  const [isGraphNodeDetailLoading, setIsGraphNodeDetailLoading] = useState(false);
  const [nodeExplanations, setNodeExplanations] = useState({});
  const [isExplanationGenerating, setIsExplanationGenerating] = useState(false);
  const [explanationError, setExplanationError] = useState(null);
  const profile = useProfileStore((state) => state.profile);
  const profileImage = useProfileStore((state) => state.profileImage);
  const profileHydrated = useProfileStore((state) => state.hydrated);
  const profileSummary = getDashboardProfileSummary(profile);

  useEffect(() => {
    let isMounted = true;

    async function hydrateDashboard() {
      setIsProjectsLoading(true);
      setProjectError(null);

      try {
        const nextWorkspaceState = loadWorkspaceState();
        const [nextProjects, nextCatalogOptions] = await Promise.all([getProjects(), getProjectCatalogOptions()]);

        if (!isMounted) {
          return;
        }

        setWorkspaceState(nextWorkspaceState);
        setProjects(nextProjects);
        setCatalogOptions(nextCatalogOptions);
        setSelectedCatalogOptionId((current) => {
          const selectedCatalogOptionIds = new Set(getSelectedCatalogOptionIds(nextProjects));

          if (
            current &&
            nextCatalogOptions.some((option) => option.id === current) &&
            !selectedCatalogOptionIds.has(current)
          ) {
            return current;
          }

          return nextCatalogOptions.find((option) => !selectedCatalogOptionIds.has(option.id))?.id || null;
        });
        setSelectedProjectId((current) => {
          const lastOpenedProjectId =
            nextWorkspaceState.lastOpenedProjectId &&
            nextProjects.some((project) => project.id === nextWorkspaceState.lastOpenedProjectId)
              ? nextWorkspaceState.lastOpenedProjectId
              : null;
          const nextSelectedId =
            (initialProjectId && nextProjects.some((project) => project.id === initialProjectId) && initialProjectId) ||
            (current && nextProjects.some((project) => project.id === current) && current) ||
            lastOpenedProjectId ||
            nextProjects[0]?.id ||
            null;

          return nextSelectedId;
        });
        setHasHydrated(true);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setProjectError(error instanceof Error ? error.message : "프로젝트를 불러오지 못했습니다.");
      } finally {
        if (isMounted) {
          setIsProjectsLoading(false);
        }
      }
    }

    hydrateDashboard();

    return () => {
      isMounted = false;
    };
  }, [initialProjectId]);

  useEffect(() => {
    if (!selectedProjectId) {
      setRecentChats([]);
      setBackendGraph(null);
      setRecentGraphNodes([]);
      setSelectedChatId(null);
      setIsChatsLoading(false);
      setChatError(null);
      return;
    }

    let isMounted = true;

    async function hydrateChats() {
      setIsChatsLoading(true);
      setChatError(null);

      try {
        const [nextChats, nextGraph, nextRecentGraphNodes] = await Promise.all([
          getProjectChats(selectedProjectId),
          getProjectGraphData(selectedProjectId).catch(() => null),
          getRecentGraphNodes(selectedProjectId).catch(() => []),
        ]);

        if (!isMounted) {
          return;
        }

        setRecentChats(nextChats);
        setBackendGraph(nextGraph);
        setRecentGraphNodes(nextRecentGraphNodes);
        setSelectedChatId((current) => {
          const canUseInitialChat =
            !hasAppliedInitialChatRef.current &&
            initialChatId &&
            nextChats.some((chat) => chat.id === initialChatId) &&
            current !== initialChatId;

          if (canUseInitialChat) {
            hasAppliedInitialChatRef.current = true;
            return initialChatId;
          }

          if (current && nextChats.some((chat) => chat.id === current)) {
            return current;
          }

          return nextChats[0]?.id || null;
        });
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setChatError(error instanceof Error ? error.message : "채팅 목록을 불러오지 못했습니다.");
        setRecentChats([]);
        setRecentGraphNodes([]);
        setSelectedChatId(null);
      } finally {
        if (isMounted) {
          setIsChatsLoading(false);
        }
      }
    }

    hydrateChats();

    return () => {
      isMounted = false;
    };
  }, [initialChatId, selectedProjectId]);

  useEffect(() => {
    if (!hasHydrated) {
      return;
    }

    const params = new URLSearchParams();

    if (selectedProjectId) {
      params.set("projectId", selectedProjectId);
    }

    if (selectedChatId) {
      params.set("chatId", selectedChatId);
    }

    const nextUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    router.replace(nextUrl, { scroll: false });

    if (selectedProjectId) {
      const nextWorkspaceState = {
        ...loadWorkspaceState(),
        lastOpenedProjectId: selectedProjectId
      };

      saveWorkspaceState(nextWorkspaceState);
      setWorkspaceState(nextWorkspaceState);
    }
  }, [hasHydrated, pathname, router, selectedChatId, selectedProjectId]);

  const activeProjectData = useMemo(() => {
    if (!selectedProjectId) {
      return null;
    }

    return getProjectData(selectedProjectId, workspaceState);
  }, [selectedProjectId, workspaceState]);

  const activeChat = useMemo(
    () => recentChats.find((chat) => chat.id === selectedChatId) || null,
    [recentChats, selectedChatId]
  );

  const activeChatMessages = activeChat?.messages || [];
  const activeChatLastMessage = activeChatMessages[activeChatMessages.length - 1] || null;
  const activeChatScrollKey = `${activeChatMessages.length}:${activeChatLastMessage?.id || ""}:${
    activeChatLastMessage?.text || ""
  }`;
  const projectGraph = useMemo(
    () => {
      const projectInput = activeProjectData
        ? {
            projectId: activeProjectData.projectId,
            title: activeProjectData.title,
          }
        : null;

      return backendGraph
        ? buildBackendKnowledgeGraph(projectInput, backendGraph, recentChats)
        : buildProjectKnowledgeGraph(projectInput, recentChats);
    },
    [activeProjectData, backendGraph, recentChats]
  );
  const updatedConcepts = useMemo(
    () =>
      recentGraphNodes.length
        ? recentGraphNodes.map((node) => node.name).filter(Boolean).slice(0, 3)
        : activeProjectData
          ? buildUpdatedConcepts(activeProjectData, workspaceState, projectGraph.nodes)
          : [],
    [activeProjectData, projectGraph.nodes, recentGraphNodes, workspaceState]
  );
  const selectedUpdatedConceptNode = useMemo(() => {
    if (!selectedUpdatedConceptLabel) {
      return null;
    }

    return (
      projectGraph.nodes.find(
        (node) => node.kind === "concept" && node.label.toLowerCase() === selectedUpdatedConceptLabel.toLowerCase()
      ) || null
    );
  }, [projectGraph.nodes, selectedUpdatedConceptLabel]);
  const selectedUpdatedConceptDescription = useMemo(() => {
    const selectedRecentNode = recentGraphNodes.find(
      (node) => node.name?.toLowerCase() === selectedUpdatedConceptLabel?.toLowerCase()
    );

    if (selectedRecentNode?.description) {
      return selectedRecentNode.description;
    }

    if (selectedUpdatedConceptNode?.description) {
      return selectedUpdatedConceptNode.description;
    }

    if (selectedUpdatedConceptLabel) {
      return `${selectedUpdatedConceptLabel} 개념 설명이 아직 연결되지 않았습니다.`;
    }

    return "최근 업데이트된 개념을 선택하면 해당 설명이 표시됩니다.";
  }, [recentGraphNodes, selectedUpdatedConceptLabel, selectedUpdatedConceptNode]);
  const selectedUpdatedConceptToneIndex = Math.max(0, updatedConcepts.indexOf(selectedUpdatedConceptLabel));
  const visibleGraphDetailNode = useMemo(
    () => projectGraph.nodes.find((node) => node.id === visibleGraphDetailNodeId) || null,
    [projectGraph.nodes, visibleGraphDetailNodeId]
  );
  const visibleGraphDetailConcepts = useMemo(() => {
    if (!visibleGraphDetailNode) {
      return [];
    }

    return visibleGraphDetailNode.relatedConceptIds
      .map((nodeId) => projectGraph.nodes.find((node) => node.id === nodeId))
      .filter(Boolean);
  }, [projectGraph.nodes, visibleGraphDetailNode]);
  const graphSearchResults = useMemo(() => {
    if (!projectGraph.nodes.length) {
      return [];
    }

    const normalizedQuery = graphSearchQuery.trim().toLowerCase();
    const source = normalizedQuery
      ? projectGraph.nodes.filter((node) =>
          `${node.label} ${node.subtitle}`.toLowerCase().includes(normalizedQuery)
        )
      : projectGraph.nodes;

    return source.slice(0, 8);
  }, [graphSearchQuery, projectGraph.nodes]);

  useEffect(() => {
    latestProjectNoteRef.current = projectNote;
  }, [projectNote]);

  useEffect(() => {
    const projectId = activeProjectData?.projectId;

    if (!projectId) {
      setProjectNote("");
      setProjectNoteProjectId(null);
      setIsProjectNoteDirty(false);
      setIsProjectNoteSaving(false);
      setProjectNoteError(null);
      return undefined;
    }

    let cancelled = false;

    setProjectNoteProjectId(projectId);
    setIsProjectNoteDirty(false);
    setIsProjectNoteSaving(false);
    setProjectNoteError(null);

    async function loadProjectMemo() {
      try {
        const note = await getProjectMemo(projectId);

        if (cancelled) {
          return;
        }

        setProjectNote(note);
        latestProjectNoteRef.current = note;
        setWorkspaceState(loadWorkspaceState());
      } catch (error) {
        if (!cancelled) {
          setProjectNote("");
          setProjectNoteError(error instanceof Error ? error.message : "프로젝트 메모를 불러오지 못했습니다.");
        }
      }
    }

    loadProjectMemo();

    return () => {
      cancelled = true;
    };
  }, [activeProjectData?.projectId]);

  useEffect(() => {
    if (!projectNoteProjectId || !isProjectNoteDirty) {
      return undefined;
    }

    let cancelled = false;
    const noteToSave = projectNote;
    const projectId = projectNoteProjectId;

    const timeoutId = window.setTimeout(async () => {
      setIsProjectNoteSaving(true);

      try {
        await saveProjectMemo(projectId, noteToSave);

        if (cancelled) {
          return;
        }

        if (latestProjectNoteRef.current === noteToSave) {
          setIsProjectNoteDirty(false);
        }

        setProjectNoteError(null);
        setWorkspaceState(loadWorkspaceState());
      } catch (error) {
        if (!cancelled) {
          setProjectNoteError(error instanceof Error ? error.message : "프로젝트 메모를 저장하지 못했습니다.");
        }
      } finally {
        if (!cancelled) {
          setIsProjectNoteSaving(false);
        }
      }
    }, 500);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [isProjectNoteDirty, projectNote, projectNoteProjectId]);

  useEffect(() => {
    if (!chatLogRef.current) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      if (!chatLogRef.current) {
        return;
      }

      chatLogRef.current.scrollTop = chatLogRef.current.scrollHeight;
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [activeChatScrollKey, activeTab, selectedChatId, selectedProjectId]);

  useEffect(() => {
    if (!updatedConcepts.length) {
      setSelectedUpdatedConceptLabel(null);
      return;
    }

    setSelectedUpdatedConceptLabel((current) =>
      current && updatedConcepts.includes(current) ? current : updatedConcepts[0]
    );
  }, [updatedConcepts]);

  useEffect(() => {
    if (activeProjectData?.projectId) {
      setSelectedGraphNodeId(projectGraph.defaultSelectedNodeId);
      setGraphFocusNodeId(projectGraph.defaultSelectedNodeId);
      setGraphDetailNodeId(null);
      setVisibleGraphDetailNodeId(null);
      setGraphNodeDetail(null);
      setExplanationError(null);
      setGraphResetKey((current) => current + 1);
    } else {
      setSelectedGraphNodeId(null);
      setGraphDetailNodeId(null);
      setVisibleGraphDetailNodeId(null);
      setGraphFocusNodeId(null);
      setGraphNodeDetail(null);
      setExplanationError(null);
    }

    setIsGraphSearchOpen(false);
    setGraphSearchQuery("");
  }, [activeProjectData?.projectId, projectGraph.defaultSelectedNodeId]);

  useEffect(() => {
    if (!selectedGraphNodeId) {
      return;
    }

    if (!projectGraph.nodes.some((node) => node.id === selectedGraphNodeId)) {
      setSelectedGraphNodeId(projectGraph.defaultSelectedNodeId);
      setGraphFocusNodeId(projectGraph.defaultSelectedNodeId);
    }
  }, [projectGraph.defaultSelectedNodeId, projectGraph.nodes, selectedGraphNodeId]);

  useEffect(() => {
    if (graphDetailNodeId && projectGraph.nodes.some((node) => node.id === graphDetailNodeId)) {
      setVisibleGraphDetailNodeId(graphDetailNodeId);
      return;
    }

    if (!visibleGraphDetailNodeId) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setVisibleGraphDetailNodeId(null);
    }, 280);

    return () => window.clearTimeout(timeoutId);
  }, [graphDetailNodeId, projectGraph.nodes, visibleGraphDetailNodeId]);

  useEffect(() => {
    if (activeTab === "graph" || !isGraphSearchOpen) {
      return;
    }

    setIsGraphSearchOpen(false);
    setGraphSearchQuery("");
  }, [activeTab, isGraphSearchOpen]);

  useEffect(() => {
    if (activeTab !== "graph") {
      return;
    }

    if (!graphDetailNodeId && selectedGraphNodeId) {
      setGraphDetailNodeId(selectedGraphNodeId);
      setVisibleGraphDetailNodeId(selectedGraphNodeId);
    }

    function handleSearchShortcut(event) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") {
        event.preventDefault();
        setIsGraphSearchOpen(true);
      }
    }

    window.addEventListener("keydown", handleSearchShortcut);

    return () => {
      window.removeEventListener("keydown", handleSearchShortcut);
    };
  }, [activeTab, graphDetailNodeId, selectedGraphNodeId]);

  useEffect(() => {
    if (activeTab !== "graph" || !isGraphSearchOpen) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      graphSearchInputRef.current?.focus();
      graphSearchInputRef.current?.select?.();
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [activeTab, isGraphSearchOpen]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key !== "Escape") {
        return;
      }

      if (activeTab === "graph" && isGraphSearchOpen) {
        setIsGraphSearchOpen(false);
        setGraphSearchQuery("");
        return;
      }

      if (isCreateOpen) {
        setIsCreateOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeTab, isCreateOpen, isGraphSearchOpen]);

  function requestGraphFocus(nodeId) {
    setGraphFocusNodeId(null);

    if (!nodeId) {
      return;
    }

    window.requestAnimationFrame(() => {
      setGraphFocusNodeId(nodeId);
    });
  }

  function handleSelectProject(projectId) {
    setSelectedProjectId(projectId);
    setSelectedChatId(null);
    setIsProjectListExpanded(false);
    setChatError(null);
  }

  async function handleCreateProject(projectId = selectedCatalogOptionId) {
    if (!projectId || isCreatingProject) {
      return;
    }

    try {
      setIsCreatingProject(true);
      setProjectError(null);
      const nextProject = await selectProjectFromCatalog(projectId);
      const [nextProjects, nextCatalogOptions] = await Promise.all([getProjects(), getProjectCatalogOptions()]);
      const selectedCatalogOptionIds = new Set(getSelectedCatalogOptionIds(nextProjects));

      setWorkspaceState(loadWorkspaceState());
      setProjects(nextProjects);
      setCatalogOptions(nextCatalogOptions);
      setSelectedProjectId(nextProject.id);
      setSelectedChatId(null);
      setSelectedCatalogOptionId(nextCatalogOptions.find((option) => !selectedCatalogOptionIds.has(option.id))?.id || null);
      setIsCreateOpen(false);
      setIsProjectListExpanded(false);
    } catch (error) {
      setProjectError(error instanceof Error ? error.message : "프로젝트를 선택하지 못했습니다.");
    } finally {
      setIsCreatingProject(false);
    }
  }

  async function handleCreateChat() {
    if (!selectedProjectId) {
      return;
    }

    try {
      const nextChat = await createChat(selectedProjectId);
      const nextProjects = await getProjects();
      const nextChats = await getProjectChats(selectedProjectId);

      setProjects(nextProjects);
      setRecentChats(nextChats);
      setSelectedChatId(nextChat.id);
      setActiveTab("chat");
      setWorkspaceState(loadWorkspaceState());
    } catch (error) {
      setChatError(error instanceof Error ? error.message : "새 채팅을 생성하지 못했습니다.");
    }
  }

  async function handleSendMessage(event) {
    event.preventDefault();

    const nextMessage = composerText.trim();

    if (!selectedProjectId || !nextMessage || isSendingMessage) {
      return;
    }

    const now = new Date().toISOString();
    const pendingChatId = selectedChatId || recentChats[0]?.id || `${selectedProjectId}-api-thread`;
    const pendingUserMessage = {
      id: `${pendingChatId}-pending-user-${Date.now()}`,
      role: "user",
      text: nextMessage,
    };
    const pendingAssistantMessage = {
      id: `${pendingChatId}-pending-assistant-${Date.now()}`,
      role: "assistant",
      text: "...",
      isPending: true,
    };

    setIsSendingMessage(true);
    setChatError(null);
    setComposerText("");
    setSelectedChatId(pendingChatId);
    setRecentChats((currentChats) => {
      const existingChat =
        currentChats.find((chat) => chat.id === pendingChatId) ||
        activeChat ||
        currentChats[0] ||
        null;
      const nextChat = existingChat
        ? {
            ...existingChat,
            updatedAt: now,
            messages: [...existingChat.messages, pendingUserMessage, pendingAssistantMessage],
          }
        : {
            id: pendingChatId,
            projectId: selectedProjectId,
            title: nextMessage,
            updatedAt: now,
            messages: [pendingUserMessage, pendingAssistantMessage],
          };

      return [nextChat, ...currentChats.filter((chat) => chat.id !== nextChat.id)];
    });

    try {
      await sendChatMessage(selectedProjectId, nextMessage);
      const [nextProjects, nextChats, nextGraph, nextRecentGraphNodes] = await Promise.all([
        getProjects(),
        getProjectChats(selectedProjectId),
        getProjectGraphData(selectedProjectId).catch(() => null),
        getRecentGraphNodes(selectedProjectId).catch(() => []),
      ]);

      setProjects(nextProjects);
      setRecentChats(nextChats);
      setBackendGraph(nextGraph);
      setRecentGraphNodes(nextRecentGraphNodes);
      setSelectedChatId((currentChatId) =>
        currentChatId && nextChats.some((chat) => chat.id === currentChatId) ? currentChatId : nextChats[0]?.id || null
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "채팅 메시지를 전송하지 못했습니다.";

      setChatError(errorMessage);
      setRecentChats((currentChats) =>
        currentChats.map((chat) =>
          chat.id === pendingChatId
            ? {
                ...chat,
                messages: chat.messages.map((message) =>
                  message.id === pendingAssistantMessage.id
                    ? {
                        ...message,
                        text: errorMessage,
                        isPending: false,
                      }
                    : message
                ),
              }
            : chat
        )
      );
    } finally {
      setIsSendingMessage(false);
    }
  }

  function handleNoteChange(note) {
    if (!activeProjectData?.projectId) {
      return;
    }

    latestProjectNoteRef.current = note;
    setProjectNote(note);
    setProjectNoteProjectId(activeProjectData.projectId);
    setIsProjectNoteDirty(true);
  }

  function handleGraphSearchSelect(nodeId) {
    handleGraphNodeSelect(nodeId);
    requestGraphFocus(nodeId);
    setIsGraphSearchOpen(false);
    setGraphSearchQuery("");
  }

  async function handleGraphNodeSelect(nodeId) {
    setSelectedGraphNodeId(nodeId);
    setGraphDetailNodeId(nodeId);
    setGraphNodeDetail(null);
    setExplanationError(null);

    if (!nodeId) {
      return;
    }

    setIsGraphNodeDetailLoading(true);

    try {
      const detail = await getGraphNodeDetail(nodeId);
      setGraphNodeDetail(detail);
    } catch {
      setGraphNodeDetail(null);
    } finally {
      setIsGraphNodeDetailLoading(false);
    }
  }

  function handleResetGraphView() {
    setGraphResetKey((current) => current + 1);
  }

  function handleGraphHistoryClick() {
    // Navigation to the exact chat/message will be wired after backend data is available.
  }

  async function handleCreateNodeExplanation() {
    if (!activeProjectData?.projectId || !visibleGraphDetailNode || isExplanationGenerating) {
      return;
    }

    setIsExplanationGenerating(true);
    setExplanationError(null);

    try {
      const response = await createExplanation({
        projectId: activeProjectData.projectId,
        nodeId: visibleGraphDetailNode.id,
        question: `${visibleGraphDetailNode.label} 개념을 현재 학습 맥락에 맞게 설명해줘.`,
      });

      setNodeExplanations((current) => ({
        ...current,
        [visibleGraphDetailNode.id]: response,
      }));
    } catch (error) {
      setExplanationError(error instanceof Error ? error.message : "맞춤 설명을 생성하지 못했습니다.");
    } finally {
      setIsExplanationGenerating(false);
    }
  }

  const workspaceHeading = activeProjectData
    ? activeChat?.title
      ? `${activeProjectData.title} - ${activeChat.title}`
      : activeProjectData.title
    : "프로젝트를 선택해주세요";
  const visibleGraphDetailDescription =
    graphNodeDetail?.node_id === visibleGraphDetailNode?.id && graphNodeDetail?.description
      ? graphNodeDetail.description
      : visibleGraphDetailNode?.description || "";
  const visibleNodeExplanation = visibleGraphDetailNode ? nodeExplanations[visibleGraphDetailNode.id] : "";

  return (
    <div className={`workspace-shell ${activeTab === "graph" ? "workspace-shell-graph-mode" : ""}`}>
      <header className="workspace-main-header workspace-panel">
        <Link href="/" className="workspace-brand-link" aria-label="eeum 홈">
          <EeumIcon className="workspace-brand-icon" />
          <span className="workspace-brand-text">이음</span>
        </Link>

        <div className="workspace-main-header-copy">
          <h1>{workspaceHeading}</h1>
        </div>

        <div className="workspace-tab-group">
          <button
            type="button"
            className={`workspace-tab ${activeTab === "chat" ? "workspace-tab-active" : ""}`}
            onClick={() => setActiveTab("chat")}
          >
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z" />
            </svg>
            채팅
          </button>
          <button
            type="button"
            className={`workspace-tab ${activeTab === "graph" ? "workspace-tab-active" : ""}`}
            onClick={() => setActiveTab("graph")}
          >
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <circle cx="12" cy="5" r="2.5" />
              <circle cx="6" cy="18" r="2.5" />
              <circle cx="18" cy="18" r="2.5" />
              <path d="m11 7-4 8" />
              <path d="m13 7 4 8" />
              <path d="M8.5 18h7" />
            </svg>
            그래프
          </button>
        </div>
      </header>

      <aside className="workspace-sidebar workspace-panel">
        <div className="workspace-sidebar-top">
          <button
            type="button"
            className="workspace-create-button"
            onClick={() => {
              setProjectError(null);
              setSelectedCatalogOptionId((current) => {
                const selectedCatalogOptionIds = new Set(getSelectedCatalogOptionIds(projects));

                if (current && !selectedCatalogOptionIds.has(current)) {
                  return current;
                }

                return catalogOptions.find((option) => !selectedCatalogOptionIds.has(option.id))?.id || null;
              });
              setIsCreateOpen(true);
            }}
          >
            + 새 프로젝트 생성
          </button>
        </div>

        <div className="workspace-sidebar-main">
          <ProjectSelector
            projects={projects}
            selectedProjectId={selectedProjectId}
            isExpanded={isProjectListExpanded}
            onToggle={() => setIsProjectListExpanded((current) => !current)}
            onSelect={handleSelectProject}
            isLoading={isProjectsLoading}
            error={projectError}
          />

          <RecentChatList
            chats={recentChats}
            selectedChatId={selectedChatId}
            onSelect={setSelectedChatId}
            onCreateChat={handleCreateChat}
            canCreateChat={Boolean(selectedProjectId) && !isProjectsLoading}
            isLoading={isChatsLoading}
            error={chatError}
            selectedProjectTitle={activeProjectData?.title || null}
          />
        </div>

        <div className="workspace-sidebar-footer">
          <WorkspaceProfileCard />
        </div>
      </aside>

      <main className="workspace-main">
        {activeTab === "chat" ? (
          <section className="workspace-chat-stage">
            <div className="workspace-chat-log" ref={chatLogRef}>
              {!selectedProjectId && !isProjectsLoading ? (
                <div className="workspace-empty-copy">프로젝트를 선택하면 해당 과목의 채팅이 표시됩니다.</div>
              ) : null}

              {selectedProjectId && !isChatsLoading && !activeChat ? (
                <div className="workspace-empty-copy">이 프로젝트에는 아직 채팅이 없습니다. 새 대화를 시작해보세요.</div>
              ) : null}

              {activeChatMessages.map((message) => (
                <article
                  key={message.id}
                  data-message-id={message.id}
                  className={`workspace-message workspace-message-${message.role}${
                    message.isPending ? " workspace-message-pending" : ""
                  }`}
                >
                  {message.role === "assistant" ? (
                    <>
                      <div className="workspace-message-head">
                        <span className="workspace-message-badge">
                          <EeumIcon className="workspace-message-badge-icon" isLoading={Boolean(message.isPending)} />
                          <span>이음 AI</span>
                        </span>
                      </div>
                      <div className="workspace-message-bubble">
                        {message.isPending ? (
                          <div className="workspace-message-loading-dots" aria-label="AI 응답 생성 중">
                            <span />
                            <span />
                            <span />
                          </div>
                        ) : (
                          <p>{message.text}</p>
                        )}

                        {!message.isPending ? (
                          <div className="workspace-message-tags">
                            <span className="workspace-message-tag workspace-message-tag-blue">핵심 수준: 중급</span>
                            <span className="workspace-message-tag workspace-message-tag-amber">
                              부족 개념: 기아 현상
                            </span>
                          </div>
                        ) : null}
                      </div>
                    </>
                  ) : (
                    <div className="workspace-message-user-row">
                      <div className="workspace-message-bubble">
                        <p>{message.text}</p>
                      </div>
                      <ProfileAvatar
                        name={profileSummary.displayName}
                        image={profileHydrated ? profileImage : null}
                        size={46}
                        className="workspace-message-user-avatar"
                      />
                    </div>
                  )}
                </article>
              ))}
            </div>

            <form className="workspace-composer" onSubmit={handleSendMessage}>
              <div className="workspace-composer-input-shell">
                <input
                  ref={composerFileInputRef}
                  className="workspace-composer-file-input"
                  type="file"
                  onChange={(event) => {
                    event.currentTarget.value = "";
                  }}
                  tabIndex={-1}
                />
                <button
                  type="button"
                  className="workspace-composer-attach-button"
                  aria-label="파일 첨부"
                  disabled={!selectedProjectId || isSendingMessage}
                  onClick={() => composerFileInputRef.current?.click()}
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24">
                    <path d="M21.4 11.7 12 21.1a6.2 6.2 0 0 1-8.8-8.8l9.9-9.9a4.2 4.2 0 0 1 5.9 5.9l-9.9 9.9a2.1 2.1 0 0 1-3-3l9.2-9.2" />
                  </svg>
                </button>
                <input
                  type="text"
                  placeholder="질문을 입력하세요."
                  value={composerText}
                  onChange={(event) => setComposerText(event.target.value)}
                  disabled={!selectedProjectId || isSendingMessage}
                />
                <button
                  type="submit"
                  className="workspace-composer-send-button"
                  aria-label="전송"
                  disabled={!selectedProjectId || !composerText.trim() || isSendingMessage}
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24">
                    <path d="m5 12 14-7-7 14-2-5-5-2Z" />
                    <path d="m10 14 4-4" />
                  </svg>
                </button>
              </div>
            </form>
          </section>
        ) : (
          <section className="workspace-graph-stage">
            <div className="workspace-graph-view workspace-panel">
              <div className="workspace-graph-view-header">
                <div className="workspace-graph-view-heading">
                  <strong>Knowledge Graph</strong>
                  <span>{activeProjectData ? activeProjectData.title : "프로젝트를 선택해주세요"}</span>
                </div>

                <div className="workspace-graph-header-actions">
                  <button
                    type="button"
                    className="workspace-graph-header-button"
                    onClick={() => setIsGraphSearchOpen(true)}
                    disabled={!projectGraph.nodes.length}
                    aria-label="노드 검색 열기"
                  >
                    <SearchIcon />
                  </button>
                  <button
                    type="button"
                    className="workspace-graph-header-button"
                    onClick={handleResetGraphView}
                    disabled={!projectGraph.nodes.length}
                    aria-label="그래프 뷰 초기화"
                  >
                    <ResetIcon />
                  </button>
                </div>
              </div>
              <div className="workspace-graph-view-body">
                <div className="workspace-graph-controls">
                  <button
                    type="button"
                    className={`workspace-graph-control ${isGraphSearchOpen ? "workspace-graph-control-active" : ""}`}
                    onClick={() => setIsGraphSearchOpen(true)}
                    disabled={!projectGraph.nodes.length}
                  >
                    노드 찾기
                  </button>
                  <button
                    type="button"
                    className="workspace-graph-control"
                    onClick={handleResetGraphView}
                    disabled={!projectGraph.nodes.length}
                  >
                    뷰 초기화
                  </button>
                  <div className="workspace-graph-control-caption">Ctrl/Cmd + F</div>
                  <div className="workspace-graph-control-copy">휠로 확대/축소</div>
                  <div className="workspace-graph-control-copy">드래그로 화면 이동</div>
                </div>

                <div className="workspace-graph-canvas">
                  {projectGraph.nodes.length ? (
                    <>
                      <KnowledgeGraphScene
                        nodes={projectGraph.nodes}
                        edges={projectGraph.edges}
                        interactive
                        showLabels
                        labelVariant="light"
                        selectedNodeId={selectedGraphNodeId}
                        onNodeSelect={handleGraphNodeSelect}
                        focusNodeId={graphFocusNodeId}
                        resetViewKey={graphResetKey}
                      />

                      {isGraphSearchOpen ? (
                        <div className="workspace-graph-search-panel">
                          <div className="workspace-graph-search-input-wrap">
                            <SearchIcon />
                            <input
                              ref={graphSearchInputRef}
                              type="text"
                              value={graphSearchQuery}
                              onChange={(event) => setGraphSearchQuery(event.target.value)}
                              placeholder="노드 이름으로 검색"
                            />
                            <button
                              type="button"
                              className="workspace-graph-search-close"
                              onClick={() => {
                                setIsGraphSearchOpen(false);
                                setGraphSearchQuery("");
                              }}
                              aria-label="노드 검색 닫기"
                            >
                              ×
                            </button>
                          </div>

                          <div className="workspace-graph-search-results">
                            {graphSearchResults.length ? (
                              graphSearchResults.map((node) => (
                                <button
                                  key={node.id}
                                  type="button"
                                  className={`workspace-graph-search-result ${
                                    node.id === selectedGraphNodeId ? "workspace-graph-search-result-active" : ""
                                  }`}
                                  onClick={() => handleGraphSearchSelect(node.id)}
                                >
                                  <strong>{node.label}</strong>
                                  <span>{node.subtitle}</span>
                                </button>
                              ))
                            ) : (
                              <div className="workspace-graph-search-empty">일치하는 노드가 없습니다.</div>
                            )}
                          </div>
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <div className="workspace-empty-copy workspace-graph-empty">
                      프로젝트를 선택하면 해당 학습 흐름의 그래프가 표시됩니다.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div
              className={`workspace-graph-detail-drawer ${
                graphDetailNodeId ? "workspace-graph-detail-drawer-open" : ""
              }`}
              aria-hidden={!graphDetailNodeId}
            >
              <aside className="workspace-graph-detail-panel workspace-panel">
                <div className="workspace-graph-detail">
                  <div className="workspace-graph-detail-heading">노드 상세 정보</div>

                  {visibleGraphDetailNode ? (
                    <>
                      <section
                        className="workspace-graph-detail-card"
                        style={{
                          borderColor: `${visibleGraphDetailNode.color}88`,
                          background: `${visibleGraphDetailNode.color}1f`,
                        }}
                      >
                        <div
                          className="workspace-graph-detail-card-dot"
                          style={{ background: visibleGraphDetailNode.color }}
                        />
                        <div>
                          <strong>{visibleGraphDetailNode.label}</strong>
                          <span>{visibleGraphDetailNode.subtitle}</span>
                        </div>
                      </section>

                      <section className="workspace-resource-section">
                        <h2>개념 설명</h2>
                        <p className="workspace-resource-copy">
                          {isGraphNodeDetailLoading ? "노드 상세 정보를 불러오는 중입니다." : visibleGraphDetailDescription}
                        </p>
                        {visibleNodeExplanation ? (
                          <p className="workspace-resource-copy">{visibleNodeExplanation}</p>
                        ) : null}
                        {explanationError ? <p className="workspace-modal-error">{explanationError}</p> : null}
                        <button
                          type="button"
                          className="workspace-secondary-button"
                          onClick={handleCreateNodeExplanation}
                          disabled={isExplanationGenerating}
                        >
                          {isExplanationGenerating ? "생성 중..." : "맞춤 설명 생성"}
                        </button>
                      </section>

                      <section className="workspace-resource-section">
                        <h2>관련 개념</h2>
                        <div className="workspace-graph-related-list">
                          {visibleGraphDetailConcepts.length ? (
                            visibleGraphDetailConcepts.map((topic) => (
                              <div key={topic.id} className="workspace-graph-related-item">
                                <span
                                  className="workspace-graph-related-dot"
                                  style={{ background: topic.color }}
                                />
                                <span>{topic.label}</span>
                              </div>
                            ))
                          ) : (
                            <div className="workspace-graph-empty-copy">연결된 관련 개념이 없습니다.</div>
                          )}
                        </div>
                      </section>

                      <section className="workspace-resource-section">
                        <h2>관련 학습 기록</h2>
                        <div className="workspace-graph-history-list">
                          {visibleGraphDetailNode.relatedLearningEvents.length ? (
                            visibleGraphDetailNode.relatedLearningEvents.map((entry) => (
                              <button
                                key={entry.id}
                                type="button"
                                className="workspace-graph-history-item workspace-graph-history-button"
                                onClick={handleGraphHistoryClick}
                              >
                                <span>{formatUpdatedAt(entry.updatedAt)}</span>
                                <strong>{entry.preview}</strong>
                              </button>
                            ))
                          ) : (
                            <div className="workspace-graph-empty-copy">연결된 학습 기록이 없습니다.</div>
                          )}
                        </div>
                      </section>
                    </>
                  ) : null}
                </div>
              </aside>
            </div>
          </section>
        )}
      </main>

      {activeTab !== "graph" ? (
      <div className="workspace-resource-shell">
        <aside className="workspace-resource-panel workspace-panel">
          <button
            type="button"
            className="workspace-upload-button"
            onClick={() => {
              if (!activeProjectData?.projectId) {
                return;
              }

              router.push(`/upload?projectId=${encodeURIComponent(activeProjectData.projectId)}`);
            }}
            disabled={!activeProjectData}
          >
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path
                d="M9.5 17.5 17.3 9.7a3.1 3.1 0 0 0-4.38-4.38L5.8 12.44a4.6 4.6 0 0 0 6.5 6.5l7.08-7.08"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
              />
              <path
                d="M8.76 15.24 15.2 8.8"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
              />
            </svg>
            자료 업로드
          </button>

          {!activeProjectData ? (
            <div className="workspace-empty-copy">프로젝트를 선택하면 학습 자료와 메모를 확인할 수 있습니다.</div>
          ) : null}

          <section className="workspace-resource-section workspace-resource-section-concepts">
            <h2>최근 업데이트된 개념</h2>
            <div className="workspace-concept-list">
              {updatedConcepts.length ? (
                <>
                  <div className="workspace-concept-chip-row">
                    {updatedConcepts.map((concept, index) => (
                      <button
                        key={`${concept}-${index}`}
                        type="button"
                        className={`workspace-concept-chip ${
                          selectedUpdatedConceptLabel === concept ? "workspace-concept-chip-active" : ""
                        }`}
                        onClick={() => setSelectedUpdatedConceptLabel(concept)}
                      >
                        {concept}
                      </button>
                    ))}
                  </div>

                  <div
                    className={`workspace-concept-description-block workspace-concept-description-block-tone-${
                      selectedUpdatedConceptToneIndex + 1
                    }`}
                  >
                    <strong>개념 설명 — {selectedUpdatedConceptLabel}</strong>
                    <p className="workspace-concept-description">{selectedUpdatedConceptDescription}</p>
                  </div>
                </>
              ) : (
                <div className="workspace-empty-copy">최근 업데이트된 개념이 없습니다.</div>
              )}
            </div>
          </section>

          <section className="workspace-resource-section workspace-resource-section-memo">
            <h2>메모장</h2>
            <textarea
              value={projectNote}
              onChange={(event) => handleNoteChange(event.target.value)}
              placeholder="학습 중 떠오른 생각을 자유롭게 적어보세요."
            />
            {projectNoteError ? <p className="workspace-modal-error">{projectNoteError}</p> : null}
            {!projectNoteError && isProjectNoteSaving ? (
              <p className="workspace-empty-copy">메모를 저장하는 중입니다.</p>
            ) : null}
          </section>
        </aside>
      </div>
      ) : null}

      {isCreateOpen ? (
        <ProjectCatalogModal
          options={catalogOptions}
          selectedOptionId={selectedCatalogOptionId}
          selectedCatalogOptionIds={getSelectedCatalogOptionIds(projects)}
          onSelectOption={setSelectedCatalogOptionId}
          onClose={() => {
            if (isCreatingProject) {
              return;
            }

            setIsCreateOpen(false);
          }}
          onConfirm={handleCreateProject}
          isCreating={isCreatingProject}
          errorMessage={projectError}
        />
      ) : null}

    </div>
  );
}
