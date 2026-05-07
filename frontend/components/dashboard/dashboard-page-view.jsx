"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import KnowledgeGraphScene from "../graph/knowledge-graph-scene";
import { buildBackendKnowledgeGraph, buildProjectKnowledgeGraph } from "../../features/dashboard/graph";
import {
  getDefaultWorkspaceState,
  getDiagnosisSummary,
  getProjectDiagnosis,
  getProjectNote,
  loadWorkspaceState,
  saveProjectNote,
  saveWorkspaceState,
} from "../../features/workspace/storage";
import {
  createChat,
  createProject,
  getProjectGraphData,
  getProjectChats,
  getProjects,
  sendChatMessage,
} from "../../features/dashboard/service";
import { getProjectData } from "../../features/project/model";
import WorkspaceProfileCard from "./WorkspaceProfileCard";

function CreateProjectModal({ draftName, onDraftChange, onClose, onCreate, isCreating, errorMessage }) {
  return (
    <div className="workspace-modal-backdrop" onClick={onClose}>
      <form
        className="workspace-modal-panel"
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          onCreate();
        }}
      >
        <p className="workspace-modal-eyebrow">New Project</p>
        <h2 className="workspace-modal-title">새 학습을 시작합니다</h2>
        <p className="workspace-modal-copy">프로젝트명을 먼저 만들고, 자료 업로드와 대화는 다음 단계에서 이어집니다.</p>

        <label className="workspace-modal-field">
          <span>프로젝트명</span>
          <input
            autoFocus
            type="text"
            value={draftName}
            onChange={(event) => onDraftChange(event.target.value)}
            placeholder="예: 운영체제 시험 대비"
          />
        </label>

        {errorMessage ? <p className="workspace-modal-error">{errorMessage}</p> : null}

        <div className="workspace-modal-actions">
          <button type="button" className="workspace-secondary-button" onClick={onClose} disabled={isCreating}>
            취소
          </button>
          <button type="submit" className="workspace-primary-button" disabled={!draftName.trim() || isCreating}>
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

  return (
    <section className="workspace-sidebar-group workspace-project-selector">
      <div className="workspace-sidebar-heading">
        <span>프로젝트</span>
        <button
          type="button"
          className="workspace-sidebar-heading-button"
          onClick={onToggle}
          disabled={!projects.length}
        >
          {isExpanded ? "접기" : "전체"}
        </button>
      </div>

      {isLoading ? <div className="workspace-empty-copy">프로젝트를 불러오는 중입니다.</div> : null}
      {error ? <div className="workspace-empty-copy">{error}</div> : null}
      {!isLoading && !error && !selectedProject ? <div className="workspace-empty-copy">프로젝트가 없습니다.</div> : null}

      {!isLoading && !error && selectedProject ? (
        <div className="workspace-project-dropdown">
          <button
            type="button"
            className="workspace-project-item workspace-project-toggle workspace-project-item-active"
            onClick={onToggle}
          >
            <span className="workspace-project-item-copy">
              <strong>{selectedProject.title}</strong>
              <small>{formatUpdatedAt(selectedProject.updatedAt)}</small>
            </span>
            <span className={`workspace-project-chevron ${isExpanded ? "workspace-project-chevron-open" : ""}`}>
              ▾
            </span>
          </button>

          {isExpanded ? (
            <div className="workspace-sidebar-section-scroll workspace-project-list">
              {projects.map((project) => (
                <button
                  key={project.id}
                  type="button"
                  className={`workspace-project-item ${
                    selectedProjectId === project.id ? "workspace-project-item-active" : ""
                  }`}
                  onClick={() => onSelect(project.id)}
                >
                  <span className="workspace-project-item-copy">
                    <strong>{project.title}</strong>
                    <small>{formatUpdatedAt(project.updatedAt)}</small>
                  </span>
                  <em />
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function RecentChatList({
  chats,
  selectedChatId,
  onSelect,
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
    </section>
  );
}

export default function DashboardPageView({ initialProjectId = null, initialChatId = null }) {
  const chatLogRef = useRef(null);
  const graphSearchInputRef = useRef(null);
  const hasAppliedInitialChatRef = useRef(false);
  const router = useRouter();
  const pathname = usePathname();
  const [workspaceState, setWorkspaceState] = useState(() => getDefaultWorkspaceState());
  const [projects, setProjects] = useState([]);
  const [recentChats, setRecentChats] = useState([]);
  const [backendGraph, setBackendGraph] = useState(null);
  const [selectedProjectId, setSelectedProjectId] = useState(() => initialProjectId || null);
  const [selectedChatId, setSelectedChatId] = useState(() => initialChatId || null);
  const [isProjectListExpanded, setIsProjectListExpanded] = useState(false);
  const [projectError, setProjectError] = useState(null);
  const [chatError, setChatError] = useState(null);
  const [isProjectsLoading, setIsProjectsLoading] = useState(true);
  const [isChatsLoading, setIsChatsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("chat");
  const [selectedUpdatedConceptLabel, setSelectedUpdatedConceptLabel] = useState(null);
  const [draftName, setDraftName] = useState("");
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

  useEffect(() => {
    let isMounted = true;

    async function hydrateDashboard() {
      setIsProjectsLoading(true);
      setProjectError(null);

      try {
        const nextWorkspaceState = loadWorkspaceState();
        const nextProjects = await getProjects();

        if (!isMounted) {
          return;
        }

        setWorkspaceState(nextWorkspaceState);
        setProjects(nextProjects);
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
        const [nextChats, nextGraph] = await Promise.all([
          getProjectChats(selectedProjectId),
          getProjectGraphData(selectedProjectId).catch(() => null),
        ]);

        if (!isMounted) {
          return;
        }

        setRecentChats(nextChats);
        setBackendGraph(nextGraph);
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
    () => (activeProjectData ? buildUpdatedConcepts(activeProjectData, workspaceState, projectGraph.nodes) : []),
    [activeProjectData, projectGraph.nodes, workspaceState]
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
    if (selectedUpdatedConceptNode?.description) {
      return selectedUpdatedConceptNode.description;
    }

    if (selectedUpdatedConceptLabel) {
      return `${selectedUpdatedConceptLabel} 개념 설명이 아직 연결되지 않았습니다.`;
    }

    return "최근 업데이트된 개념을 선택하면 해당 설명이 표시됩니다.";
  }, [selectedUpdatedConceptLabel, selectedUpdatedConceptNode]);
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
  const projectNote = activeProjectData ? getProjectNote(workspaceState, activeProjectData.projectId) : "";

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
      setGraphResetKey((current) => current + 1);
    } else {
      setSelectedGraphNodeId(null);
      setGraphDetailNodeId(null);
      setVisibleGraphDetailNodeId(null);
      setGraphFocusNodeId(null);
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
  }, [activeTab]);

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
        setDraftName("");
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

  async function handleCreateProject() {
    const nextName = draftName.trim();

    if (!nextName || isCreatingProject) {
      return;
    }

    try {
      setIsCreatingProject(true);
      setProjectError(null);
      const nextProject = await createProject(nextName);
      const nextProjects = await getProjects();

      setWorkspaceState(loadWorkspaceState());
      setProjects(nextProjects);
      setSelectedProjectId(nextProject.id);
      setSelectedChatId(null);
      setDraftName("");
      setIsCreateOpen(false);
      setIsProjectListExpanded(false);
    } catch (error) {
      setProjectError(error instanceof Error ? error.message : "프로젝트를 생성하지 못했습니다.");
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
      const [nextProjects, nextChats, nextGraph] = await Promise.all([
        getProjects(),
        getProjectChats(selectedProjectId),
        getProjectGraphData(selectedProjectId).catch(() => null),
      ]);

      setProjects(nextProjects);
      setRecentChats(nextChats);
      setBackendGraph(nextGraph);
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

    const nextWorkspaceState = saveProjectNote(loadWorkspaceState(), activeProjectData.projectId, note);

    saveWorkspaceState(nextWorkspaceState);
    setWorkspaceState(nextWorkspaceState);
  }

  function handleGraphSearchSelect(nodeId) {
    setSelectedGraphNodeId(nodeId);
    setGraphDetailNodeId(nodeId);
    requestGraphFocus(nodeId);
    setIsGraphSearchOpen(false);
    setGraphSearchQuery("");
  }

  function handleGraphNodeSelect(nodeId) {
    setSelectedGraphNodeId(nodeId);
    setGraphDetailNodeId(nodeId);
  }

  function handleResetGraphView() {
    setGraphResetKey((current) => current + 1);
  }

  function handleGraphHistoryClick() {
    // Navigation to the exact chat/message will be wired after backend data is available.
  }

  const workspaceHeading = activeProjectData
    ? activeChat?.title
      ? `${activeProjectData.title} - ${activeChat.title}`
      : activeProjectData.title
    : "프로젝트를 선택해주세요";

  return (
    <div className={`workspace-shell ${activeTab === "graph" ? "workspace-shell-graph-mode" : ""}`}>
      <header className="workspace-main-header workspace-panel">
        <Link href="/" className="workspace-brand-link workspace-main-header-brand" aria-label="eeum 홈">
          <span className="workspace-brand-ring" />
          <span className="workspace-brand-node" />
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
            채팅
          </button>
          <button
            type="button"
            className={`workspace-tab ${activeTab === "graph" ? "workspace-tab-active" : ""}`}
            onClick={() => setActiveTab("graph")}
          >
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
            isLoading={isChatsLoading}
            error={chatError}
            selectedProjectTitle={activeProjectData?.title || null}
          />
        </div>

        <div className="workspace-sidebar-footer">
          <button
            type="button"
            className="workspace-new-chat-button"
            onClick={handleCreateChat}
            disabled={!selectedProjectId || isProjectsLoading}
          >
            + 새 대화
          </button>

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
                  <div className="workspace-message-head">
                    <span className="workspace-message-badge">
                      {message.role === "assistant" ? "이음 AI" : "사용자"}
                    </span>
                  </div>
                  {message.isPending ? (
                    <div className="workspace-message-loading-dots" aria-label="AI 응답 생성 중">
                      <span />
                      <span />
                      <span />
                    </div>
                  ) : (
                    <p>{message.text}</p>
                  )}

                  {message.role === "assistant" && !message.isPending ? (
                    <div className="workspace-message-tags">
                      <span className="workspace-message-tag workspace-message-tag-blue">핵심 수준: 중급</span>
                      <span className="workspace-message-tag workspace-message-tag-amber">부족 개념: 기아 현상</span>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>

            <form className="workspace-composer" onSubmit={handleSendMessage}>
              <input
                type="text"
                placeholder="질문을 입력하세요."
                value={composerText}
                onChange={(event) => setComposerText(event.target.value)}
                disabled={!selectedProjectId || isSendingMessage}
              />
              <button
                type="submit"
                aria-label="전송"
                disabled={!selectedProjectId || !composerText.trim() || isSendingMessage}
              >
                →
              </button>
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
                        <p className="workspace-resource-copy">{visibleGraphDetailNode.description}</p>
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
            자료 업로드
          </button>

          {!activeProjectData ? (
            <div className="workspace-empty-copy">프로젝트를 선택하면 학습 자료와 메모를 확인할 수 있습니다.</div>
          ) : null}

          <section className="workspace-resource-section">
            <h2>최근 업데이트된 개념</h2>
            <div className="workspace-concept-list">
              {updatedConcepts.length ? (
                updatedConcepts.map((concept, index) => (
                  <div key={`${concept}-${index}`} className="workspace-concept-entry">
                    <button
                      type="button"
                      className={`workspace-concept-chip ${
                        selectedUpdatedConceptLabel === concept ? "workspace-concept-chip-active" : ""
                      }`}
                      onClick={() => setSelectedUpdatedConceptLabel(concept)}
                    >
                      {concept}
                    </button>

                    {selectedUpdatedConceptLabel === concept ? (
                      <div className="workspace-concept-description-block">
                        <strong>개념 설명</strong>
                        <p className="workspace-concept-description">{selectedUpdatedConceptDescription}</p>
                      </div>
                    ) : null}
                  </div>
                ))
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
          </section>
        </aside>
      </div>
      ) : null}

      {isCreateOpen ? (
        <CreateProjectModal
          draftName={draftName}
          onDraftChange={setDraftName}
          onClose={() => {
            if (isCreatingProject) {
              return;
            }

            setDraftName("");
            setIsCreateOpen(false);
          }}
          onCreate={handleCreateProject}
          isCreating={isCreatingProject}
          errorMessage={projectError}
        />
      ) : null}

    </div>
  );
}
