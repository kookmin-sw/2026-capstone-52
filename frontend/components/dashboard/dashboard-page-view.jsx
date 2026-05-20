"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
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
  createProjectMemo,
  deleteProject,
  deleteProjectMemo,
  getGraphNodeDetail,
  getGraphNodeQuizHistory,
  getProjectCatalogOptions,
  getProjectMemos,
  getProjectGraphData,
  getProjectChats,
  getProjects,
  getRecentGraphNodes,
  removeChat,
  selectProjectFromCatalog,
  sendChatMessage,
  updateProjectMemo,
} from "../../features/dashboard/service";
import { getProjectData } from "../../features/project/model";
import WorkspaceProfileCard from "./WorkspaceProfileCard";
import ProfileAvatar from "@/components/profile/ProfileAvatar";
import { getDashboardProfileSummary, useProfileStore } from "@/store/profileStore";
import MiniQuizPopup from "@/components/mini-quiz/MiniQuizPopup";
import QuizReviewPopup from "./QuizReviewPopup";
import { isDashboardBackendApiEnabled } from "../../features/dashboard/service";
import { MOCK_MINI_QUIZ_READY_CONCEPTS } from "../../features/mini-quiz/mock-data";
import {
  deferApiMiniQuizQuestion,
  generateApiMiniQuizQuestion,
  getApiDeferredMiniQuizzes,
  isMiniQuizBackendApiEnabled,
} from "../../features/mini-quiz/api-service";

const projectDotColors = ["#817cf2", "#2bbf8a", "#f29f45", "#e36b7f", "#3a9eea", "#b36bea"];
const rootKnowledgeColor = "#f5d38a";
const knowledgeStageLabels = ["진단 전", "입문", "기초", "심화", "마스터"];
const knowledgeStageColors = ["#fb923c", "#f9a8d4", "#a78bfa", "#60a5fa", "#34d399"];
const fallbackKnowledgeStageCycle = [1, 2, 3, 4, 1, 2, 3, 4, 0];
const backendStatusStageIndexMap = {
  UNSEEN: 0,
  WEAK: 1,
  PARTIAL: 2,
  FAMILIAR: 3,
  MASTERED: 4,
};
const MINI_QUIZ_READY_STORAGE_KEY = "eeum-mini-quiz-ready-v1";
const MINI_QUIZ_COMPLETED_STORAGE_KEY = "eeum-mini-quiz-completed-v1";
const MINI_QUIZ_DEFERRED_STORAGE_KEY = "eeum-mini-quiz-deferred-v1";

function getChatSessionIdFromDashboardChatId(projectId, chatId) {
  const prefix = `${projectId}-session-`;
  if (!projectId || !chatId || !chatId.startsWith(prefix)) {
    return null;
  }

  const sessionId = Number(chatId.slice(prefix.length));
  return Number.isFinite(sessionId) ? sessionId : null;
}

const miniQuizOpeningDotVariants = {
  jump: {
    y: -30,
    transition: {
      duration: 0.8,
      repeat: Infinity,
      repeatType: "mirror",
      ease: "easeInOut",
    },
  },
};

function MiniQuizOpeningOverlay() {
  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="workspace-mini-quiz-opening-overlay">
      <motion.div
        animate="jump"
        transition={{ staggerChildren: -0.2, staggerDirection: -1 }}
        className="workspace-mini-quiz-opening-loader"
        role="status"
        aria-label="미니퀴즈를 준비하는 중"
      >
        <motion.div className="workspace-mini-quiz-opening-dot" variants={miniQuizOpeningDotVariants} />
        <motion.div className="workspace-mini-quiz-opening-dot" variants={miniQuizOpeningDotVariants} />
        <motion.div className="workspace-mini-quiz-opening-dot" variants={miniQuizOpeningDotVariants} />
      </motion.div>
    </div>,
    document.body
  );
}

function canUseBrowserStorage() {
  return typeof window !== "undefined";
}

function normalizeMiniQuizReadyTargets(targets) {
  if (!Array.isArray(targets)) return [];

  return targets
    .map((target) => {
      if (!target) return null;
      const nodeId = target.nodeId ?? target.node_id ?? null;
      if (!nodeId) return null;
      return {
        nodeId: String(nodeId),
        name: target.name ?? target.node_name ?? target.nodeName ?? "미니퀴즈",
        useMockMiniQuiz: Boolean(target.useMockMiniQuiz ?? target.use_mock_mini_quiz),
      };
    })
    .filter(Boolean);
}

function loadMiniQuizReadyStore() {
  if (!canUseBrowserStorage()) return {};

  try {
    const parsed = JSON.parse(window.localStorage.getItem(MINI_QUIZ_READY_STORAGE_KEY) || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function loadProjectMiniQuizReady(projectId) {
  if (!projectId) return {};

  const projectStore = loadMiniQuizReadyStore()[String(projectId)];
  if (!projectStore || typeof projectStore !== "object" || Array.isArray(projectStore)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(projectStore).map(([messageId, targets]) => [
      messageId,
      normalizeMiniQuizReadyTargets(targets),
    ])
  );
}

function saveProjectMiniQuizReady(projectId, readyByMessage) {
  if (!projectId || !canUseBrowserStorage()) return;

  const normalized = Object.fromEntries(
    Object.entries(readyByMessage || {}).map(([messageId, targets]) => [
      messageId,
      normalizeMiniQuizReadyTargets(targets),
    ])
  );
  const store = loadMiniQuizReadyStore();
  store[String(projectId)] = normalized;
  window.localStorage.setItem(MINI_QUIZ_READY_STORAGE_KEY, JSON.stringify(store));
}

function loadMiniQuizCompletedStore() {
  if (!canUseBrowserStorage()) return {};

  try {
    const parsed = JSON.parse(window.localStorage.getItem(MINI_QUIZ_COMPLETED_STORAGE_KEY) || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function loadProjectMiniQuizCompleted(projectId) {
  if (!projectId) return {};

  const projectStore = loadMiniQuizCompletedStore()[String(projectId)];
  if (!projectStore || typeof projectStore !== "object" || Array.isArray(projectStore)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(projectStore)
      .filter(([, isCompleted]) => Boolean(isCompleted))
      .map(([messageId]) => [messageId, true])
  );
}

function saveProjectMiniQuizCompleted(projectId, completedByMessage) {
  if (!projectId || !canUseBrowserStorage()) return;

  const normalized = Object.fromEntries(
    Object.entries(completedByMessage || {}).filter(([, isCompleted]) => Boolean(isCompleted))
  );
  const store = loadMiniQuizCompletedStore();
  store[String(projectId)] = normalized;
  window.localStorage.setItem(MINI_QUIZ_COMPLETED_STORAGE_KEY, JSON.stringify(store));
}

function loadMiniQuizDeferredStore() {
  if (!canUseBrowserStorage()) return {};

  try {
    const parsed = JSON.parse(window.localStorage.getItem(MINI_QUIZ_DEFERRED_STORAGE_KEY) || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function getDeferredMiniQuizQuestionIds(item) {
  const groupQuestionIds = item?.group?.questionIds ?? item?.group?.question_ids ?? item?.questionIds ?? item?.question_ids;
  if (Array.isArray(groupQuestionIds) && groupQuestionIds.length) {
    return groupQuestionIds.map(String).filter(Boolean);
  }

  if (Array.isArray(item?.queue) && item.queue.length) {
    return item.queue
      .map((entry) => entry?.presetQuestion?.question_id ?? entry?.presetQuestion?.questionId ?? entry?.question_id ?? entry?.questionId)
      .filter(Boolean)
      .map(String);
  }

  const questionId = item?.presetQuestion?.question_id ?? item?.presetQuestion?.questionId ?? item?.question_id ?? item?.questionId;
  return questionId ? [String(questionId)] : [];
}

function isDeferredMiniQuizGroupItem(item) {
  if (!item) return false;
  if (item.groupId !== undefined && item.groupId !== null) return true;
  if (item.group_id !== undefined && item.group_id !== null) return true;
  if (Array.isArray(item.queue) && item.queue.length > 1) return true;
  if (Array.isArray(item.questions) && item.questions.length > 1) return true;
  return getDeferredMiniQuizQuestionIds(item).length > 1;
}

function getDeferredMiniQuizDedupeKey(item) {
  if (!item) return null;
  if (item.groupId !== undefined && item.groupId !== null) return `group:${item.groupId}`;
  if (item.group_id !== undefined && item.group_id !== null) return `group:${item.group_id}`;

  const questionIds = getDeferredMiniQuizQuestionIds(item);
  if (isDeferredMiniQuizGroupItem(item) && questionIds.length) {
    return `questions:${questionIds.slice().sort().join("|")}`;
  }

  const deferredId = item.deferredId ?? item.deferred_id;
  if (deferredId !== undefined && deferredId !== null) return `deferred:${deferredId}`;

  if (questionIds.length) return `question:${questionIds[0]}`;
  if (item.nodeId || item.node_id) return `node:${item.nodeId || item.node_id}`;
  return item.id ? `id:${item.id}` : null;
}

function getDeferredMiniQuizQuestionKey(item) {
  const questionIds = getDeferredMiniQuizQuestionIds(item);
  return questionIds.length > 1 ? `questions:${questionIds.slice().sort().join("|")}` : null;
}

function dedupeDeferredMiniQuizzes(items) {
  const normalizedItems = Array.isArray(items) ? items.filter(Boolean) : [];
  const groupNodeIds = new Set(
    normalizedItems
      .filter((item) => isDeferredMiniQuizGroupItem(item) && item.nodeId)
      .map((item) => String(item.nodeId))
  );
  const seenKeys = new Set();

  return normalizedItems.filter((item) => {
    if (!isDeferredMiniQuizGroupItem(item) && item?.nodeId && groupNodeIds.has(String(item.nodeId))) {
      return false;
    }

    const key = getDeferredMiniQuizDedupeKey(item);
    const questionKey = getDeferredMiniQuizQuestionKey(item);
    if (!key || seenKeys.has(key) || (questionKey && seenKeys.has(questionKey))) {
      return false;
    }
    seenKeys.add(key);
    if (questionKey) {
      seenKeys.add(questionKey);
    }
    return true;
  });
}

function getCompletedMiniQuizDeferredKeys(activeMiniQuiz, results) {
  const keys = new Set();
  if (activeMiniQuiz?.deferredKey) {
    keys.add(activeMiniQuiz.deferredKey);
  }

  const activeKey = getDeferredMiniQuizDedupeKey({
    groupId: activeMiniQuiz?.groupId,
    nodeId: activeMiniQuiz?.nodeId,
    queue: activeMiniQuiz?.queue,
  });
  if (activeKey) {
    keys.add(activeKey);
  }

  (Array.isArray(results) ? results : []).forEach((entry) => {
    const target = entry?.currentTarget || {};
    const key = getDeferredMiniQuizDedupeKey({
      nodeId: target.nodeId,
      name: target.name,
      group: target.group,
      presetQuestion: entry?.question || target.presetQuestion,
    });
    if (key) {
      keys.add(key);
    }
  });

  return keys;
}

function promoteLegacyDeferredSinglesToGroups(items, projectId) {
  const groupedSinglesByNodeId = new Map();
  const promotedItems = [];

  (Array.isArray(items) ? items : []).forEach((item) => {
    if (isDeferredMiniQuizGroupItem(item) || !item?.nodeId || !item?.presetQuestion) {
      promotedItems.push(item);
      return;
    }

    const nodeId = String(item.nodeId);
    if (!groupedSinglesByNodeId.has(nodeId)) {
      groupedSinglesByNodeId.set(nodeId, []);
    }
    groupedSinglesByNodeId.get(nodeId).push(item);
  });

  groupedSinglesByNodeId.forEach((entries) => {
    if (entries.length < 2) {
      promotedItems.push(...entries);
      return;
    }

    const firstEntry = entries[0];
    const questionIds = entries
      .map((entry) => entry.presetQuestion?.question_id || entry.presetQuestion?.questionId)
      .filter(Boolean)
      .map(String);
    const group = normalizeDeferredMiniQuizGroup(
      {
        node_id: firstEntry.nodeId,
        node_name: firstEntry.name,
        question_ids: questionIds,
        questions: entries.map((entry) => entry.presetQuestion).filter(Boolean),
        deferred_at: Math.min(...entries.map((entry) => Number(entry.deferredAt || Date.now()))),
      },
      projectId
    );

    if (group) {
      promotedItems.push(group);
    } else {
      promotedItems.push(...entries);
    }
  });

  return promotedItems;
}

function loadProjectMiniQuizDeferred(projectId) {
  if (!projectId) return [];

  const projectStore = loadMiniQuizDeferredStore()[String(projectId)];
  if (!Array.isArray(projectStore)) {
    return [];
  }

  const normalized = projectStore
    .map((item) => normalizeDeferredMiniQuizDeferred(item, projectId))
    .filter(Boolean);

  return dedupeDeferredMiniQuizzes(promoteLegacyDeferredSinglesToGroups(normalized, projectId));
}

function saveProjectMiniQuizDeferred(projectId, deferredItems) {
  if (!projectId || !canUseBrowserStorage()) return;

  const normalizedItems = (Array.isArray(deferredItems) ? deferredItems : [])
    .map((item) => normalizeDeferredMiniQuizDeferred(item, projectId))
    .filter(Boolean);
  const normalized = dedupeDeferredMiniQuizzes(promoteLegacyDeferredSinglesToGroups(normalizedItems, projectId));
  const store = loadMiniQuizDeferredStore();
  store[String(projectId)] = normalized;
  window.localStorage.setItem(MINI_QUIZ_DEFERRED_STORAGE_KEY, JSON.stringify(store));
}

function getKnowledgeStageColor(stageIndex) {
  const maxStageIndex = Math.max(knowledgeStageLabels.length - 1, 1);
  const normalizedStageIndex = Math.min(Math.max(stageIndex, 0), maxStageIndex);

  return knowledgeStageColors[normalizedStageIndex] || knowledgeStageColors[0];
}

function sortProjectMemosByUpdatedAt(memos) {
  return [...memos].sort((left, right) => {
    const leftTime = new Date(left.updatedAt || left.createdAt || 0).getTime();
    const rightTime = new Date(right.updatedAt || right.createdAt || 0).getTime();

    return rightTime - leftTime;
  });
}

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

const DIAGNOSIS_COLLAPSED_HEIGHT = 260;

function parseDiagnosisMessageBlocks(text) {
  const blocks = [];
  const codeFencePattern = /```(?:[\w-]+)?\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match = codeFencePattern.exec(text);

  while (match) {
    const textContent = text.slice(lastIndex, match.index).trim();

    if (textContent) {
      blocks.push({ type: "text", content: textContent });
    }

    blocks.push({
      type: "code",
      content: match[1].replace(/^\n/, "").replace(/\n$/, ""),
    });

    lastIndex = codeFencePattern.lastIndex;
    match = codeFencePattern.exec(text);
  }

  const remainingText = text.slice(lastIndex).trim();

  if (remainingText) {
    blocks.push({ type: "text", content: remainingText });
  }

  return blocks.length ? blocks : [{ type: "text", content: text }];
}

function renderInlineStrong(text) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={`${part}-${index}`}>{part.slice(2, -2)}</strong>;
    }

    return <span key={`${part}-${index}`}>{part}</span>;
  });
}

function renderDiagnosisTextBlock(content, blockIndex) {
  return (
    <div key={`text-${blockIndex}`} className="workspace-diagnosis-text-block">
      {content.split("\n").map((line, lineIndex) => {
        const trimmedLine = line.trim();

        if (!trimmedLine) {
          return <span key={`blank-${lineIndex}`} className="workspace-diagnosis-line workspace-diagnosis-line-blank" />;
        }

        if (trimmedLine === "---") {
          return <span key={`divider-${lineIndex}`} className="workspace-diagnosis-divider" />;
        }

        if (trimmedLine.startsWith("# ")) {
          return (
            <strong key={`heading-${lineIndex}`} className="workspace-diagnosis-heading">
              {trimmedLine.slice(2)}
            </strong>
          );
        }

        return (
          <span key={`line-${lineIndex}`} className="workspace-diagnosis-line">
            {renderInlineStrong(line)}
          </span>
        );
      })}
    </div>
  );
}

function MarkdownMessageBody({ content }) {
  return (
    <div className="workspace-message-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

function DiagnosisMessageBody({ message }) {
  const contentRef = useRef(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [canToggle, setCanToggle] = useState(false);

  useEffect(() => {
    if (!message.collapsible) {
      setCanToggle(false);
      return undefined;
    }

    const isLongByContent = message.text.length > 520 || message.text.split("\n").length > 10;
    const frameId = window.requestAnimationFrame(() => {
      const contentElement = contentRef.current;

      if (!contentElement) {
        setCanToggle(isLongByContent);
        return;
      }

      setCanToggle(isLongByContent || contentElement.scrollHeight > DIAGNOSIS_COLLAPSED_HEIGHT + 12);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [message.collapsible, message.text]);

  const blocks = parseDiagnosisMessageBlocks(message.text);
  const shouldCollapse = Boolean(message.collapsible && !isExpanded);

  return (
    <div className="workspace-diagnosis-message">
      <div
        ref={contentRef}
        className={`workspace-diagnosis-message-content ${
          shouldCollapse ? "workspace-diagnosis-message-content-collapsed" : ""
        }`}
      >
        {blocks.map((block, blockIndex) =>
          block.type === "code" ? (
            <pre key={`code-${blockIndex}`} className="workspace-diagnosis-code-block">
              <code>{block.content}</code>
            </pre>
          ) : (
            renderDiagnosisTextBlock(block.content, blockIndex)
          )
        )}
      </div>

      {canToggle ? (
        <button
          type="button"
          className="workspace-diagnosis-more-button"
          onClick={() => setIsExpanded((current) => !current)}
          aria-expanded={isExpanded}
        >
          {isExpanded ? "접기" : "더보기"}
          <svg aria-hidden="true" viewBox="0 0 20 20">
            <path d={isExpanded ? "M5 12.5 10 7.5l5 5" : "M5 7.5l5 5 5-5"} />
          </svg>
        </button>
      ) : null}
    </div>
  );
}

function ReportGraphPreview({ graph, projectTitle, onOpen }) {
  const hasGraph = graph.nodes.length > 0;

  return (
    <div
      role={hasGraph ? "button" : undefined}
      tabIndex={hasGraph ? 0 : undefined}
      className={`workspace-message-graph-preview ${
        hasGraph ? "workspace-message-graph-preview-interactive" : "workspace-message-graph-preview-empty"
      }`}
      aria-label={`${projectTitle || "프로젝트"} 지식 그래프 미리보기`}
      onClick={() => {
        if (hasGraph) {
          onOpen();
        }
      }}
      onKeyDown={(event) => {
        if (!hasGraph || (event.key !== "Enter" && event.key !== " ")) {
          return;
        }

        event.preventDefault();
        onOpen();
      }}
    >
      <div className="workspace-message-graph-preview-header">
        <div>
          <strong>Knowledge Graph</strong>
          <span>{projectTitle || "진단 개념 흐름"}</span>
        </div>
      </div>
      <div className="workspace-message-graph-preview-canvas">
        {hasGraph ? (
          <KnowledgeGraphScene
            nodes={graph.nodes}
            edges={graph.edges}
            compact
            interactive
            showLabels
            labelVariant="light"
            nodeSizeScale={0.62}
            resetViewKey={`report-preview-${projectTitle || "project"}`}
          />
        ) : (
          <span>아직 생성된 지식 그래프가 없습니다.</span>
        )}
      </div>
    </div>
  );
}

function ReportGraphOverlay({ graph, projectTitle, selectedNodeId, onSelectNode, onClose }) {
  return (
    <div className="workspace-report-graph-overlay" onClick={onClose}>
      <section
        className="workspace-report-graph-panel"
        role="dialog"
        aria-modal="true"
        aria-label={`${projectTitle || "프로젝트"} 지식 그래프`}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="workspace-report-graph-header">
          <div>
            <strong>Knowledge Graph</strong>
            <span>{projectTitle || "프로젝트"}</span>
          </div>
          <button type="button" onClick={onClose} aria-label="그래프 닫기">
            ×
          </button>
        </header>
        <div className="workspace-report-graph-canvas">
          {graph.nodes.length ? (
            <KnowledgeGraphScene
              nodes={graph.nodes}
              edges={graph.edges}
              interactive
              showLabels
              labelVariant="light"
              nodeSizeScale={0.72}
              selectedNodeId={selectedNodeId}
              onNodeSelect={onSelectNode}
              onBackgroundClick={onClose}
            />
          ) : (
            <div className="workspace-empty-copy workspace-report-graph-empty">
              아직 생성된 지식 그래프가 없습니다.
            </div>
          )}
        </div>
      </section>
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

function toArray(value) {
  if (Array.isArray(value)) {
    return value;
  }

  return value ? [value] : [];
}

function normalizeQuizToken(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function getConceptLikeTokens(value) {
  if (!value) {
    return [];
  }

  if (typeof value === "object") {
    return [
      value.id,
      value.node_id,
      value.nodeId,
      value.concept_id,
      value.conceptId,
      value.label,
      value.name,
      value.node_name,
      value.concept_name,
      value.title,
    ]
      .map(normalizeQuizToken)
      .filter(Boolean);
  }

  return [normalizeQuizToken(value)].filter(Boolean);
}

function getQuestionConceptTokens(question) {
  const references = [
    ...toArray(question.conceptIds),
    ...toArray(question.concept_ids),
    ...toArray(question.coreConceptIds),
    ...toArray(question.core_concept_ids),
    ...toArray(question.node_id),
    ...toArray(question.concept_id),
    ...(question.choices || []).flatMap((choice) => [
      ...toArray(choice.conceptIds),
      ...toArray(choice.concept_ids),
      ...toArray(choice.nodeIds),
      ...toArray(choice.node_ids),
      ...toArray(choice.nodeId),
      ...toArray(choice.node_id),
      ...toArray(choice.conceptId),
      ...toArray(choice.concept_id),
    ]),
  ];

  return new Set(references.flatMap(getConceptLikeTokens));
}

function getGraphNodeQuizTokens(node) {
  if (!node) {
    return [];
  }

  const conceptKey = node.id?.includes("-concept-") ? node.id.split("-concept-").pop() : "";

  return [...new Set([node.label, conceptKey, ...(node.keywords || [])].map(normalizeQuizToken).filter(Boolean))];
}

function getSelectedAnswerIds(answer) {
  if (Array.isArray(answer)) {
    return answer.filter(Boolean).map((choiceId) => String(choiceId));
  }

  return answer ? [String(answer)] : [];
}

function getCorrectAnswerIds(question) {
  return [
    ...toArray(question.correctChoiceIds),
    ...toArray(question.correct_choice_ids),
    ...toArray(question.correctChoiceId),
    ...toArray(question.correct_choice_id),
  ]
    .filter(Boolean)
    .map((choiceId) => String(choiceId));
}

function evaluateQuizAnswer(question, answer) {
  if (question.type === "short-answer") {
    return null;
  }

  const selectedIds = getSelectedAnswerIds(answer);
  const correctIds = getCorrectAnswerIds(question);

  if (!correctIds.length || !selectedIds.length) {
    return null;
  }

  const selectedSet = new Set(selectedIds);
  const correctSet = new Set(correctIds);

  return selectedSet.size === correctSet.size && [...selectedSet].every((choiceId) => correctSet.has(choiceId));
}

function formatQuizAnswer(question, answer) {
  if (question.type === "short-answer") {
    return typeof answer === "string" && answer.trim() ? `응답: ${answer.trim()}` : "응답: 미응답";
  }

  const selectedIds = getSelectedAnswerIds(answer);

  if (!selectedIds.length) {
    return "응답: 미응답";
  }

  const choiceLabels = new Map((question.choices || []).map((choice) => [String(choice.id), choice.label || String(choice.id)]));
  const selectedLabels = selectedIds.map((choiceId) => choiceLabels.get(choiceId) || choiceId);

  return `응답: ${selectedLabels.join(", ")}`;
}

function questionMatchesGraphNode(question, graphNode) {
  const graphTokens = getGraphNodeQuizTokens(graphNode);

  if (!graphTokens.length) {
    return false;
  }

  const questionTokens = getQuestionConceptTokens(question);
  const searchableQuestionText = normalizeQuizToken(
    [
      question.prompt,
      question.question,
      ...(question.choices || []).map((choice) => choice.label || choice.text || ""),
    ].join(" ")
  );

  return graphTokens.some((token) => questionTokens.has(token) || searchableQuestionText.includes(token));
}

function buildGraphQuizRecordPool(projectData, workspaceState, graphNode) {
  if (!projectData) {
    return {
      records: [],
      relatedRecords: [],
    };
  }

  const diagnosisEntries = (projectData.materials || [])
    .map((material) => getDiagnosisSummary(workspaceState, projectData.projectId, material.id))
    .filter(Boolean);
  const projectDiagnosis = getProjectDiagnosis(workspaceState, projectData.projectId);
  const mergedDiagnosisEntries = projectDiagnosis ? [...diagnosisEntries, projectDiagnosis] : diagnosisEntries;
  const records = mergedDiagnosisEntries.flatMap((entry, entryIndex) =>
    (entry.questions || []).map((question, questionIndex) => {
      const answer = entry.answers?.[question.id];
      const isCorrect = evaluateQuizAnswer(question, answer);
      const selectedIds = getSelectedAnswerIds(answer);
      const correctIds = getCorrectAnswerIds(question);
      const reviewChoices = (question.choices || []).map((choice) => {
        const optionId = String(choice.id ?? choice.option_id ?? "");
        return {
          option_id: optionId,
          text: choice.label || choice.text || optionId,
          is_correct: correctIds.includes(optionId),
          is_selected: selectedIds.includes(optionId),
        };
      });

      return {
        id: `${entry.sessionId || "diagnosis"}-${question.id || questionIndex}-${entryIndex}`,
        prompt: question.prompt || question.question || `퀴즈 ${questionIndex + 1}`,
        answerSummary: formatQuizAnswer(question, answer),
        isCorrect,
        statusLabel: isCorrect === null ? "응답 완료" : isCorrect ? "정답" : "오답",
        updatedAt: entry.savedAt ? new Date(entry.savedAt).toISOString() : new Date().toISOString(),
        isRelated: questionMatchesGraphNode(question, graphNode),
        reviewEntry: {
          question_id: question.id || `${entryIndex}-${questionIndex}`,
          question: question.prompt || question.question || `퀴즈 ${questionIndex + 1}`,
          choices: reviewChoices,
          correct_option_ids: correctIds,
          selected_option_ids: selectedIds,
          is_fully_correct: isCorrect,
        },
      };
    })
  );
  const relatedRecords = graphNode ? records.filter((record) => record.isRelated) : records;

  return {
    records,
    relatedRecords,
  };
}

function buildGraphQuizRecords(projectData, workspaceState, graphNode) {
  const { records, relatedRecords } = buildGraphQuizRecordPool(projectData, workspaceState, graphNode);

  return (relatedRecords.length ? relatedRecords : records).slice(0, 3);
}

function getKnowledgeStageIndexFromQuizRecords(records) {
  const scorableRecords = records.filter((record) => typeof record.isCorrect === "boolean");

  if (!scorableRecords.length) {
    return records.length ? 1 : 0;
  }

  const correctCount = scorableRecords.filter((record) => record.isCorrect).length;
  const correctRatio = correctCount / scorableRecords.length;

  if (correctRatio <= 0) {
    return 1;
  }

  if (correctRatio < 0.5) {
    return 2;
  }

  if (correctRatio < 0.85) {
    return 3;
  }

  return 4;
}

function getGraphNodeKnowledgeStageIndex(projectData, workspaceState, graphNode) {
  if (!projectData || !graphNode) {
    return 0;
  }

  const { relatedRecords } = buildGraphQuizRecordPool(projectData, workspaceState, graphNode);

  return getKnowledgeStageIndexFromQuizRecords(relatedRecords);
}

function getFallbackKnowledgeStageIndex(nodeIndex) {
  return fallbackKnowledgeStageCycle[nodeIndex % fallbackKnowledgeStageCycle.length];
}

function normalizeKnowledgeStageIndex(stageIndex) {
  const numericStageIndex = Number(stageIndex);

  if (!Number.isFinite(numericStageIndex)) {
    return 0;
  }

  return Math.min(Math.max(Math.round(numericStageIndex), 0), knowledgeStageLabels.length - 1);
}

function getBackendNodeKnowledgeStageIndex(node) {
  const diagnosisCount = Number(node?.diagnosisCount ?? 0);

  if (!Number.isFinite(diagnosisCount) || diagnosisCount <= 0) {
    return 0;
  }

  const backendStatus = String(node?.backendStatus || "").trim().toUpperCase();
  let knowledgeStageIndex = backendStatusStageIndexMap[backendStatus];

  if (knowledgeStageIndex === undefined) {
    const understandingLevel = Number(node?.understandingLevel);

    if (Number.isFinite(understandingLevel)) {
      knowledgeStageIndex = understandingLevel;
    }
  }

  if (knowledgeStageIndex === undefined) {
    const understandingScore = Number(node?.understandingScore);

    if (Number.isFinite(understandingScore)) {
      if (understandingScore < 0.45) {
        knowledgeStageIndex = 1;
      } else if (understandingScore < 0.6) {
        knowledgeStageIndex = 2;
      } else if (understandingScore < 0.8) {
        knowledgeStageIndex = 3;
      } else {
        knowledgeStageIndex = 4;
      }
    }
  }

  const normalizedStageIndex = normalizeKnowledgeStageIndex(knowledgeStageIndex ?? 0);

  if (diagnosisCount < 2) {
    return Math.min(normalizedStageIndex, 2);
  }

  if (diagnosisCount < 4) {
    return Math.min(normalizedStageIndex, 3);
  }

  return normalizedStageIndex;
}

function getBackendLikeNodeKnowledgeStageIndex(node) {
  if (!node) {
    return 0;
  }

  return getBackendNodeKnowledgeStageIndex({
    backendStatus: node.backendStatus ?? node.status ?? null,
    understandingLevel: node.understandingLevel ?? node.understanding_level ?? null,
    understandingScore: node.understandingScore ?? node.understanding_score ?? null,
    diagnosisCount: node.diagnosisCount ?? node.diagnosis_count ?? 1,
  });
}

function getMiniQuizResultNodeName(entry) {
  const backendResult = entry?.backendResult || entry?.result || {};
  const updatedNode = backendResult.updated_node || backendResult.group_result?.updated_node || null;
  return (
    backendResult.group_result?.node_name ||
    updatedNode?.display_name ||
    updatedNode?.korean_name ||
    updatedNode?.name ||
    entry?.currentTarget?.name ||
    entry?.conceptName ||
    updatedNode?.concept_id ||
    updatedNode?.node_id ||
    "이 개념"
  );
}

function getRecentGraphNodeDisplayLabel(node) {
  return (
    node?.display_name ||
    node?.displayName ||
    node?.korean_name ||
    node?.koreanName ||
    node?.name ||
    node?.concept_id ||
    node?.conceptId ||
    node?.node_id ||
    node?.nodeId ||
    ""
  );
}

function getMiniQuizResultStageLabel(entry) {
  const backendResult = entry?.backendResult || entry?.result || {};
  const updatedNode = backendResult.updated_node || backendResult.group_result?.updated_node || null;
  const stageIndex = getBackendLikeNodeKnowledgeStageIndex(updatedNode);
  return knowledgeStageLabels[stageIndex] || knowledgeStageLabels[0];
}

function extractMiniQuizResultFeedback(text) {
  if (typeof text !== "string") {
    return "";
  }

  const paragraphs = text
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
  const feedback = paragraphs
    .slice()
    .reverse()
    .find((part) => !/^개념\s*:/.test(part) && !/그룹\s*점수/.test(part));

  return feedback || "";
}

function buildMiniQuizResultDisplayText(entry) {
  const backendResult = entry?.backendResult || entry?.result || {};
  const updatedNode = backendResult.updated_node || backendResult.group_result?.updated_node || null;
  const rawText =
    typeof backendResult?.result_message?.ai_response === "string"
      ? backendResult.result_message.ai_response.trim()
      : "";
  if (!rawText && !updatedNode) {
    return "";
  }

  const nodeName = getMiniQuizResultNodeName(entry);
  const stageLabel = getMiniQuizResultStageLabel(entry);
  const feedback = extractMiniQuizResultFeedback(rawText);

  return [
    "방금 푼 미니퀴즈 결과를 반영했어요.",
    `현재 개념: **${nodeName}**의 이해 상태가 업데이트 되었습니다.\n현재 이해 단계는 **${stageLabel}** 단계입니다.`,
    feedback,
  ]
    .filter(Boolean)
    .join("\n\n");
}

function applyKnowledgeStagesToGraph(graph, projectData, workspaceState, options = {}) {
  let conceptNodeIndex = 0;

  return {
    ...graph,
    nodes: graph.nodes.map((node) => {
      if (node.isProjectRoot) {
        return {
          ...node,
          color: rootKnowledgeColor,
          knowledgeStageIndex: 0,
          knowledgeStageLabel: "프로젝트",
        };
      }

      if (options.useBackendNodeState) {
        const knowledgeStageIndex = getBackendNodeKnowledgeStageIndex(node);

        return {
          ...node,
          color: getKnowledgeStageColor(knowledgeStageIndex),
          knowledgeStageIndex,
          knowledgeStageLabel: knowledgeStageLabels[knowledgeStageIndex],
        };
      }

      if (node.isCore) {
        const knowledgeStageIndex = getGraphNodeKnowledgeStageIndex(projectData, workspaceState, node);

        return {
          ...node,
          color: getKnowledgeStageColor(knowledgeStageIndex),
          knowledgeStageIndex,
          knowledgeStageLabel: knowledgeStageLabels[knowledgeStageIndex],
        };
      }

      const rawKnowledgeStageIndex = getGraphNodeKnowledgeStageIndex(projectData, workspaceState, node);
      const knowledgeStageIndex =
        rawKnowledgeStageIndex === 0 ? getFallbackKnowledgeStageIndex(conceptNodeIndex) : rawKnowledgeStageIndex;
      conceptNodeIndex += 1;

      return {
        ...node,
        color: getKnowledgeStageColor(knowledgeStageIndex),
        knowledgeStageIndex,
        knowledgeStageLabel: knowledgeStageLabels[knowledgeStageIndex],
      };
    }),
  };
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

function normalizeMiniQuizPresetQuestion(question, fallback = {}) {
  if (!question) return null;
  const nodeId = question.concept_id ?? question.conceptId ?? question.node_id ?? question.nodeId ?? fallback.nodeId ?? null;
  const choices = Array.isArray(question.choices)
    ? question.choices.map((choice, index) => {
        if (choice && typeof choice === "object") {
          return {
            option_id: String(choice.option_id ?? choice.optionId ?? choice.id ?? index),
            text: choice.text ?? choice.label ?? String(choice.value ?? index),
          };
        }
        return {
          option_id: String(index),
          text: String(choice),
        };
      })
    : [];

  return {
    ...question,
    question_id: String(question.question_id ?? question.questionId ?? ""),
    concept_id: nodeId !== null ? String(nodeId) : "",
    concept_name:
      question.concept_name ??
      question.conceptName ??
      question.node_name ??
      question.nodeName ??
      fallback.name ??
      null,
    question: question.question ?? "",
    question_type: question.question_type ?? question.questionType ?? "multi_select",
    choices,
  };
}

function buildMiniQuizGroupMeta(group, fallbackTarget = {}) {
  const questionIds = Array.isArray(group?.question_ids)
    ? group.question_ids.map(String)
    : Array.isArray(group?.questionIds)
      ? group.questionIds.map(String)
      : [];

  return {
    nodeId: String(group?.node_id ?? group?.nodeId ?? fallbackTarget.nodeId ?? ""),
    name: group?.node_name ?? group?.nodeName ?? fallbackTarget.name ?? null,
    questionIds,
  };
}

function buildMiniQuizQueueFromQuestionPayload(payload, target = {}) {
  const questions = Array.isArray(payload?.questions) ? payload.questions : [];
  const group = buildMiniQuizGroupMeta(payload?.group, target);

  return questions
    .map((question) => {
      const presetQuestion = normalizeMiniQuizPresetQuestion(question, {
        nodeId: group.nodeId || target.nodeId,
        name: group.name || target.name,
      });
      if (!presetQuestion?.question_id) return null;

      return {
        nodeId: group.nodeId || target.nodeId,
        name: group.name || target.name,
        presetQuestion,
        group,
        useMockMiniQuiz: false,
      };
    })
    .filter(Boolean);
}

function normalizeDeferredMiniQuizItem(item, projectId) {
  if (!item) return null;
  const deferredId = item.deferred_id ?? item.deferredId ?? null;
  const nodeId = item.node_id ?? item.nodeId ?? null;
  if (!nodeId) return null;
  const id = deferredId !== null ? `deferred-${deferredId}` : `deferred-${nodeId}`;
  const existingPresetQuestion = item.presetQuestion ?? item.preset_question ?? null;
  const choices = Array.isArray(item.choices)
    ? item.choices.map((choice) => ({
        option_id: String(choice.option_id ?? choice.optionId ?? ""),
        text: choice.text ?? choice.label ?? "",
      }))
    : Array.isArray(existingPresetQuestion?.choices)
      ? existingPresetQuestion.choices.map((choice) => ({
          option_id: String(choice.option_id ?? choice.optionId ?? ""),
          text: choice.text ?? choice.label ?? "",
        }))
    : [];
  const presetQuestion =
    existingPresetQuestion
      ? {
          ...existingPresetQuestion,
          question_id: String(existingPresetQuestion.question_id ?? existingPresetQuestion.questionId ?? ""),
          concept_id: String(existingPresetQuestion.concept_id ?? existingPresetQuestion.conceptId ?? nodeId),
          concept_name: existingPresetQuestion.concept_name ?? existingPresetQuestion.conceptName ?? item.node_name ?? item.nodeName ?? item.name ?? null,
          question_type: existingPresetQuestion.question_type ?? existingPresetQuestion.questionType ?? "multi_select",
          choices,
        }
      : item.question_id || item.questionId
      ? {
          question_id: String(item.question_id ?? item.questionId),
          concept_id: String(nodeId),
          concept_name: item.node_name ?? item.nodeName ?? item.name ?? null,
          question: item.question ?? "",
          // 백엔드 미니퀴즈는 multi_select 기준으로 채점됨 — DeferredMiniQuizItem 응답에 question_type 필드가 없어
          // 프론트에서 단일선택으로 잘못 처리되지 않도록 강제로 multi_select로 지정.
          question_type: item.question_type ?? item.questionType ?? "multi_select",
          choices,
        }
      : null;
  return {
    id,
    deferredId,
    nodeId: String(nodeId),
    name: item.node_name ?? item.nodeName ?? item.name ?? null,
    projectId,
    deferredAt: item.deferred_at ?? item.deferredAt ?? Date.now(),
    presetQuestion,
    useMockMiniQuiz: Boolean(item.useMockMiniQuiz ?? item.use_mock_mini_quiz),
  };
}

function normalizeDeferredMiniQuizGroup(group, projectId) {
  if (!group) return null;
  const nodeId = group.node_id ?? group.nodeId ?? null;
  if (!nodeId) return null;
  const groupId = group.group_id ?? group.groupId ?? null;
  const name = group.node_name ?? group.nodeName ?? group.name ?? null;
  const questionIds = Array.isArray(group.question_ids)
    ? group.question_ids.map(String)
    : Array.isArray(group.questionIds)
      ? group.questionIds.map(String)
      : [];
  const questions = Array.isArray(group.questions) ? group.questions : [];
  const groupMeta = {
    nodeId: String(nodeId),
    name,
    questionIds,
  };
  const queue = questions
    .map((question) => {
      const presetQuestion = normalizeMiniQuizPresetQuestion(question, {
        nodeId,
        name,
      });
      if (!presetQuestion?.question_id) return null;
      return {
        nodeId: String(nodeId),
        name,
        presetQuestion,
        group: groupMeta,
        useMockMiniQuiz: false,
      };
    })
    .filter(Boolean);

  if (!queue.length) return null;

  return {
    id: groupId !== null ? `deferred-group-${groupId}` : `deferred-group-${nodeId}-${questionIds.join("-")}`,
    groupId,
    deferredId: null,
    nodeId: String(nodeId),
    name,
    projectId,
    deferredAt: group.deferred_at ?? group.deferredAt ?? Date.now(),
    presetQuestion: queue[0]?.presetQuestion || null,
    queue,
    useMockMiniQuiz: false,
  };
}

function normalizeDeferredMiniQuizDeferred(item, projectId) {
  if (!item) return null;

  if (!isDeferredMiniQuizGroupItem(item)) {
    return normalizeDeferredMiniQuizItem(item, projectId);
  }

  const nodeId = item.node_id ?? item.nodeId ?? item.group?.node_id ?? item.group?.nodeId ?? null;
  if (!nodeId) return null;

  const queueQuestions = Array.isArray(item.queue)
    ? item.queue.map((entry) => entry?.presetQuestion || entry).filter(Boolean)
    : [];
  const questions = queueQuestions.length
    ? queueQuestions
    : Array.isArray(item.questions)
      ? item.questions
      : [];
  const questionIds = getDeferredMiniQuizQuestionIds(item);

  return normalizeDeferredMiniQuizGroup(
    {
      group_id: item.group_id ?? item.groupId ?? null,
      node_id: nodeId,
      node_name: item.node_name ?? item.nodeName ?? item.name ?? item.group?.node_name ?? item.group?.nodeName ?? null,
      question_ids: questionIds,
      questions,
      deferred_at: item.deferred_at ?? item.deferredAt ?? Date.now(),
    },
    projectId
  );
}

function normalizeDeferredMiniQuizApiResponse(response, projectId) {
  if (Array.isArray(response?.groups) && response.groups.length > 0) {
    return response.groups
      .map((group) => normalizeDeferredMiniQuizGroup(group, projectId))
      .filter(Boolean);
  }

  return (Array.isArray(response?.items) ? response.items : [])
    .map((item) => normalizeDeferredMiniQuizItem(item, projectId))
    .filter(Boolean);
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
  onDeleteProject,
  isLoading,
  error
}) {
  const selectedProject = projects.find((project) => project.id === selectedProjectId) || null;
  const visibleProjects = isExpanded ? projects : selectedProject ? [selectedProject] : [];
  const [openProjectMenu, setOpenProjectMenu] = useState(null);
  const projectListRef = useRef(null);
  const projectMenuRef = useRef(null);

  useEffect(() => {
    if (!openProjectMenu) return undefined;

    function handleOutsidePointerDown(event) {
      if (projectListRef.current?.contains(event.target)) {
        return;
      }

      if (projectMenuRef.current?.contains(event.target)) {
        return;
      }

      setOpenProjectMenu(null);
    }

    document.addEventListener("pointerdown", handleOutsidePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handleOutsidePointerDown);
    };
  }, [openProjectMenu]);

  const projectMenuPortal =
    openProjectMenu && canUseBrowserStorage()
      ? createPortal(
          <div
            ref={projectMenuRef}
            className="workspace-shortcut-menu"
            role="menu"
            style={{ left: `${openProjectMenu.left}px`, top: `${openProjectMenu.top}px` }}
          >
            <button
              type="button"
              role="menuitem"
              className="workspace-shortcut-menu-danger"
              onClick={() => {
                const project = projects.find((item) => item.id === openProjectMenu.projectId) || null;
                setOpenProjectMenu(null);
                if (project) {
                  onDeleteProject(project);
                }
              }}
            >
              프로젝트 삭제하기
            </button>
          </div>,
          document.body
        )
      : null;

  return (
    <>
    <section className="workspace-sidebar-group workspace-project-selector">
      <button
        type="button"
        className="workspace-sidebar-heading workspace-sidebar-heading-toggle"
        onClick={onToggle}
        disabled={!projects.length}
        aria-expanded={isExpanded}
        aria-label={isExpanded ? "프로젝트 목록 접기" : "프로젝트 목록 펼치기"}
      >
        <span>프로젝트</span>
        <span
          className={`workspace-sidebar-heading-chevron ${
            isExpanded ? "workspace-sidebar-heading-chevron-open" : ""
          }`}
          aria-hidden="true"
        >
          ⌄
        </span>
      </button>

      {isLoading ? <div className="workspace-empty-copy">프로젝트를 불러오는 중입니다.</div> : null}
      {error ? <div className="workspace-empty-copy">{error}</div> : null}
      {!isLoading && !error && !selectedProject ? <div className="workspace-empty-copy">프로젝트가 없습니다.</div> : null}

      {!isLoading && !error && visibleProjects.length ? (
        <div ref={projectListRef} className={`workspace-sidebar-section-scroll workspace-project-list ${
          isExpanded ? "workspace-project-list-open" : ""
        }`}>
          {visibleProjects.map((project) => {
            const projectIndex = projects.findIndex((candidate) => candidate.id === project.id);
            const dotColor = projectDotColors[(projectIndex >= 0 ? projectIndex : 0) % projectDotColors.length];

            return (
              <div
                key={project.id}
                className={`workspace-project-row ${
                  selectedProjectId === project.id ? "workspace-project-item-active" : ""
                }`}
              >
                <button
                  type="button"
                  className={`workspace-project-item workspace-project-item-${project.id}`}
                  style={{ "--workspace-project-dot-color": dotColor }}
                  onClick={() => {
                    setOpenProjectMenu(null);
                    onSelect(project.id);
                  }}
                >
                  <em />
                  <span className="workspace-project-item-copy">
                    <strong>
                      {!isExpanded && selectedProjectId === project.id ? `${project.title}` : project.title}
                    </strong>
                  </span>
                </button>
                <button
                  type="button"
                  className="workspace-shortcut-menu-button"
                  aria-label={`${project.title} 프로젝트 메뉴 열기`}
                  aria-haspopup="menu"
                  aria-expanded={openProjectMenu?.projectId === project.id}
                  onClick={(event) => {
                    event.stopPropagation();
                    const buttonRect = event.currentTarget.getBoundingClientRect();
                    const menuWidth = 184;
                    const viewportPadding = 10;
                    const maxLeft = Math.max(viewportPadding, window.innerWidth - menuWidth - viewportPadding);
                    const left = Math.min(
                      Math.max(viewportPadding, buttonRect.right - menuWidth),
                      maxLeft
                    );

                    setOpenProjectMenu((current) =>
                      current?.projectId === project.id
                        ? null
                        : {
                            projectId: project.id,
                            left,
                            top: buttonRect.bottom + 6,
                          }
                    );
                  }}
                >
                  <span aria-hidden="true">•••</span>
                </button>
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
    {projectMenuPortal}
    </>
  );
}

function RecentChatList({
  chats,
  selectedChatId,
  onSelect,
  onCreateChat,
  onDeleteChat,
  canCreateChat,
  isLoading,
  error,
  selectedProjectTitle
}) {
  const [openChatMenu, setOpenChatMenu] = useState(null);
  const chatListRef = useRef(null);
  const chatMenuRef = useRef(null);

  useEffect(() => {
    if (!openChatMenu) return undefined;

    function handleOutsidePointerDown(event) {
      if (chatListRef.current?.contains(event.target)) {
        return;
      }

      if (chatMenuRef.current?.contains(event.target)) {
        return;
      }

      setOpenChatMenu(null);
    }

    document.addEventListener("pointerdown", handleOutsidePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handleOutsidePointerDown);
    };
  }, [openChatMenu]);

  const chatMenuPortal =
    openChatMenu && canUseBrowserStorage()
      ? createPortal(
          <div
            ref={chatMenuRef}
            className="workspace-chat-shortcut-menu"
            role="menu"
            style={{ left: `${openChatMenu.left}px`, top: `${openChatMenu.top}px` }}
          >
            {/* Rename requires a backend PATCH route; keep the menu placeholder for now. */}
            <button
              type="button"
              role="menuitem"
              onClick={() => setOpenChatMenu(null)}
            >
              이름 수정하기
            </button>
            <button
              type="button"
              role="menuitem"
              className="workspace-chat-shortcut-menu-danger"
              onClick={() => {
                const chat = chats.find((item) => item.id === openChatMenu.chatId) || null;
                setOpenChatMenu(null);
                if (chat) {
                  onDeleteChat(chat);
                }
              }}
            >
              채팅 삭제하기
            </button>
          </div>,
          document.body
        )
      : null;

  return (
    <>
    <section className="workspace-sidebar-group workspace-sidebar-group-fill">
      <div className="workspace-sidebar-heading">
        <span>최근 채팅</span>
      </div>
      <div ref={chatListRef} className="workspace-sidebar-section-scroll workspace-chat-shortcuts">
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
              <div
                key={chat.id}
                className={`workspace-chat-shortcut-row ${
                  selectedChatId === chat.id ? "workspace-chat-shortcut-row-active" : ""
                }`}
              >
                <button
                  type="button"
                  className={`workspace-chat-shortcut ${
                    selectedChatId === chat.id ? "workspace-chat-shortcut-active" : ""
                  }`}
                  onClick={() => {
                    setOpenChatMenu(null);
                    onSelect(chat.id);
                  }}
                >
                  <span className="workspace-chat-shortcut-title">{chat.title}</span>
                  <small className="workspace-chat-shortcut-meta">{formatUpdatedAt(chat.updatedAt)}</small>
                </button>
                <button
                  type="button"
                  className="workspace-chat-shortcut-menu-button"
                  aria-label={`${chat.title} 채팅 메뉴 열기`}
                  aria-haspopup="menu"
                  aria-expanded={openChatMenu?.chatId === chat.id}
                  onClick={(event) => {
                    event.stopPropagation();
                    const buttonRect = event.currentTarget.getBoundingClientRect();
                    const menuWidth = 184;
                    const viewportPadding = 10;
                    const maxLeft = Math.max(viewportPadding, window.innerWidth - menuWidth - viewportPadding);
                    const left = Math.min(
                      Math.max(viewportPadding, buttonRect.right - menuWidth),
                      maxLeft
                    );

                    setOpenChatMenu((current) =>
                      current?.chatId === chat.id
                        ? null
                        : {
                            chatId: chat.id,
                            left,
                            top: buttonRect.bottom + 6,
                          }
                    );
                  }}
                >
                  <span aria-hidden="true">•••</span>
                </button>
              </div>
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
    {chatMenuPortal}
    </>
  );
}

export default function DashboardPageView({ initialProjectId = null, initialChatId = null }) {
  const chatLogRef = useRef(null);
  const graphSearchInputRef = useRef(null);
  const composerFileInputRef = useRef(null);
  const hasAppliedInitialChatRef = useRef(false);
  const newlyCreatedChatIdRef = useRef(null);
  const latestProjectMemoDraftRef = useRef({ memoId: null, title: "", content: "" });
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
  const [isReportGraphOpen, setIsReportGraphOpen] = useState(false);
  const [selectedReportGraphNodeId, setSelectedReportGraphNodeId] = useState(null);
  const [composerText, setComposerText] = useState("");
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [miniQuizReadyByMessage, setMiniQuizReadyByMessage] = useState({});
  const [miniQuizCompletedByMessage, setMiniQuizCompletedByMessage] = useState({});
  const [activeMiniQuiz, setActiveMiniQuiz] = useState(null);
  const [deferredMiniQuizzes, setDeferredMiniQuizzes] = useState([]);
  const [isDeferredMiniQuizListOpen, setIsDeferredMiniQuizListOpen] = useState(false);
  const [miniQuizDeferredPanelPlacement, setMiniQuizDeferredPanelPlacement] = useState("below");
  const [miniQuizFloatOffset, setMiniQuizFloatOffset] = useState({ x: 0, y: 0 });
  const [miniQuizFloatDockSide, setMiniQuizFloatDockSide] = useState("right");
  const [isMiniQuizFloatDragging, setIsMiniQuizFloatDragging] = useState(false);
  const [openingMiniQuizMessageId, setOpeningMiniQuizMessageId] = useState(null);
  const chatStageRef = useRef(null);
  const miniQuizFloatWrapRef = useRef(null);
  const miniQuizFloatDragRef = useRef(null);
  const previousDeferredMiniQuizCountRef = useRef(0);
  const miniQuizOpenRequestIdRef = useRef(0);
  const miniQuizOpeningRef = useRef(false);

  function updateMiniQuizReadyByMessage(updater) {
    const projectId = selectedProjectId;
    setMiniQuizReadyByMessage((current) => {
      const next = typeof updater === "function" ? updater(current) : updater;
      if (projectId) {
        saveProjectMiniQuizReady(projectId, next);
      }
      return next;
    });
  }

  function updateMiniQuizCompletedByMessage(updater) {
    const projectId = selectedProjectId;
    setMiniQuizCompletedByMessage((current) => {
      const next = typeof updater === "function" ? updater(current) : updater;
      if (projectId) {
        saveProjectMiniQuizCompleted(projectId, next);
      }
      return next;
    });
  }

  function updateDeferredMiniQuizzes(updater) {
    const projectId = selectedProjectId;
    setDeferredMiniQuizzes((current) => {
      const next = dedupeDeferredMiniQuizzes(typeof updater === "function" ? updater(current) : updater);
      if (projectId) {
        saveProjectMiniQuizDeferred(projectId, next);
      }
      return next;
    });
  }

  function updateMiniQuizDeferredPanelPlacement() {
    if (!miniQuizFloatWrapRef.current || typeof window === "undefined") return;

    const buttonRect = miniQuizFloatWrapRef.current.getBoundingClientRect();
    const gap = 12;
    const estimatedHeaderHeight = 54;
    const estimatedRowHeight = 50;
    const estimatedListPadding = 16;
    const maxListHeight = 352;
    const estimatedPanelHeight =
      estimatedHeaderHeight +
      Math.min(maxListHeight, visibleDeferredMiniQuizzes.length * estimatedRowHeight + estimatedListPadding);
    const belowSpace = window.innerHeight - buttonRect.bottom;

    setMiniQuizDeferredPanelPlacement(belowSpace >= estimatedPanelHeight + gap ? "below" : "above");
  }

  function getClampedMiniQuizFloatOffset(nextOffset) {
    if (!miniQuizFloatWrapRef.current || typeof window === "undefined") {
      return {
        offset: nextOffset,
        dockSide: miniQuizFloatDockSide,
      };
    }

    const buttonRect = miniQuizFloatWrapRef.current.getBoundingClientRect();
    const rootFontSize = parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;
    const horizontalInset = rootFontSize * 1.6;
    const topInset = rootFontSize * 1.1;
    const buttonSize = buttonRect.width || 54;
    const baseLeft = window.innerWidth - horizontalInset - buttonSize;
    const baseTop = topInset;
    const minLeft = 0;
    const minTop = 0;
    const maxLeft = Math.max(minLeft, window.innerWidth - buttonSize);
    const maxTop = Math.max(minTop, window.innerHeight - buttonSize);
    const nextLeft = baseLeft + nextOffset.x;
    const nextTop = baseTop + nextOffset.y;
    const clampedLeft = Math.min(Math.max(nextLeft, minLeft), maxLeft);
    const clampedTop = Math.min(Math.max(nextTop, minTop), maxTop);

    return {
      offset: {
        x: clampedLeft - baseLeft,
        y: clampedTop - baseTop,
      },
      dockSide: clampedLeft + buttonSize / 2 < window.innerWidth / 2 ? "left" : "right",
    };
  }

  function getInitialMiniQuizFloatOffset() {
    if (!chatStageRef.current || !miniQuizFloatWrapRef.current || typeof window === "undefined") {
      return {
        offset: { x: 0, y: 0 },
        dockSide: "right",
      };
    }

    const stageRect = chatStageRef.current.getBoundingClientRect();
    const buttonRect = miniQuizFloatWrapRef.current.getBoundingClientRect();
    const rootFontSize = parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;
    const horizontalInset = rootFontSize * 1.6;
    const topInset = rootFontSize * 1.1;
    const buttonSize = buttonRect.width || 54;
    const baseLeft = window.innerWidth - horizontalInset - buttonSize;
    const baseTop = topInset;
    const targetLeft = stageRect.right - horizontalInset - buttonSize;
    const targetTop = stageRect.top + topInset;

    return getClampedMiniQuizFloatOffset({
      x: targetLeft - baseLeft,
      y: targetTop - baseTop,
    });
  }

  function clampMiniQuizFloatToViewport() {
    const { offset, dockSide } = getClampedMiniQuizFloatOffset(miniQuizFloatOffset);
    setMiniQuizFloatDockSide(dockSide);
    setMiniQuizFloatOffset(offset);
  }

  function handleMiniQuizFloatPointerDown(event) {
    if (event.button !== undefined && event.button !== 0) return;
    event.preventDefault();
    setIsMiniQuizFloatDragging(true);
    miniQuizFloatDragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      initialOffsetX: miniQuizFloatOffset.x,
      initialOffsetY: miniQuizFloatOffset.y,
      currentOffset: miniQuizFloatOffset,
      moved: false,
    };

    function handleMove(moveEvent) {
      const drag = miniQuizFloatDragRef.current;
      if (!drag) return;
      const dx = moveEvent.clientX - drag.startX;
      const dy = moveEvent.clientY - drag.startY;
      if (!drag.moved && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
        drag.moved = true;
      }
      const { offset, dockSide } = getClampedMiniQuizFloatOffset({
        x: drag.initialOffsetX + dx,
        y: drag.initialOffsetY + dy,
      });
      drag.currentOffset = offset;
      setMiniQuizFloatDockSide(dockSide);
      setMiniQuizFloatOffset(offset);
    }

    function handleUp() {
      const drag = miniQuizFloatDragRef.current;
      const { offset, dockSide } = getClampedMiniQuizFloatOffset(drag?.currentOffset || miniQuizFloatOffset);
      setMiniQuizFloatDockSide(dockSide);
      setMiniQuizFloatOffset(offset);
      setIsMiniQuizFloatDragging(false);
      document.removeEventListener("pointermove", handleMove);
      document.removeEventListener("pointerup", handleUp);
      document.removeEventListener("pointercancel", handleUp);
    }

    document.addEventListener("pointermove", handleMove);
    document.addEventListener("pointerup", handleUp);
    document.addEventListener("pointercancel", handleUp);
  }

  function handleMiniQuizFloatClick() {
    const drag = miniQuizFloatDragRef.current;
    miniQuizFloatDragRef.current = null;
    if (drag?.moved) return;
    setIsDeferredMiniQuizListOpen((current) => {
      const shouldOpen = !current;
      if (shouldOpen) {
        updateMiniQuizDeferredPanelPlacement();
      }
      return shouldOpen;
    });
  }
  const [graphNodeQuizHistory, setGraphNodeQuizHistory] = useState([]);
  const [isGraphNodeQuizHistoryLoading, setIsGraphNodeQuizHistoryLoading] = useState(false);
  const [activeQuizReview, setActiveQuizReview] = useState(null);
  const [miniQuizResults, setMiniQuizResults] = useState([]);
  const [projectMemos, setProjectMemos] = useState([]);
  const [selectedProjectMemoId, setSelectedProjectMemoId] = useState(null);
  const [projectMemoTitle, setProjectMemoTitle] = useState("");
  const [projectMemoContent, setProjectMemoContent] = useState("");
  const [projectMemoProjectId, setProjectMemoProjectId] = useState(null);
  const [projectMemoViewMode, setProjectMemoViewMode] = useState("list");
  const [isProjectMemoDirty, setIsProjectMemoDirty] = useState(false);
  const [isProjectMemoSaving, setIsProjectMemoSaving] = useState(false);
  const [isProjectMemoLoading, setIsProjectMemoLoading] = useState(false);
  const [projectMemoError, setProjectMemoError] = useState(null);
  const [showProjectMemoTitleWarning, setShowProjectMemoTitleWarning] = useState(false);
  const [projectMemoTitleWarningMessage, setProjectMemoTitleWarningMessage] = useState("제목을 정해주세요");
  const [isProjectMemoTitleShaking, setIsProjectMemoTitleShaking] = useState(false);
  const [isProjectMemoDeleteMode, setIsProjectMemoDeleteMode] = useState(false);
  const [selectedProjectMemoDeleteIds, setSelectedProjectMemoDeleteIds] = useState([]);
  const [isProjectMemoDeleting, setIsProjectMemoDeleting] = useState(false);
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
      setRecentChats([]);
      setBackendGraph(null);
      setRecentGraphNodes([]);

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
  }, [hasHydrated, pathname, router, selectedChatId, selectedProjectId]);

  useEffect(() => {
    if (!hasHydrated || !selectedProjectId) {
      return;
    }

    const currentWorkspaceState = loadWorkspaceState();
    if (currentWorkspaceState.lastOpenedProjectId === selectedProjectId) {
      return;
    }

    const nextWorkspaceState = {
      ...currentWorkspaceState,
      lastOpenedProjectId: selectedProjectId
    };

    saveWorkspaceState(nextWorkspaceState);
    setWorkspaceState(nextWorkspaceState);
  }, [hasHydrated, selectedProjectId]);

  const activeProjectData = useMemo(() => {
    if (!selectedProjectId) {
      return null;
    }

    if (isDashboardBackendApiEnabled) {
      // 백엔드 모드: 로컬 catalog fallback 사용하지 않고 projects state에서 직접 구성.
      const backendProject = projects.find((project) => project.id === selectedProjectId);
      if (!backendProject) {
        return null;
      }
      return {
        projectId: backendProject.id,
        title: backendProject.title,
        materials: [],
        chatMessages: [],
        graphNodes: [],
      };
    }

    return getProjectData(selectedProjectId, workspaceState);
  }, [selectedProjectId, projects, workspaceState]);

  const activeChat = useMemo(
    () => recentChats.find((chat) => chat.id === selectedChatId) || null,
    [recentChats, selectedChatId]
  );

  useEffect(() => {
    setMiniQuizReadyByMessage(loadProjectMiniQuizReady(selectedProjectId));
    setMiniQuizCompletedByMessage(loadProjectMiniQuizCompleted(selectedProjectId));
  }, [selectedProjectId]);

  const rawActiveChatMessages = activeChat?.messages || [];

  // mock 모드일 때만 — 진단 그래프 프리뷰 메시지 뒤에 미니퀴즈 안내 말풍선을 합성 메시지로 추가.
  // 백엔드 모드에서는 실제 chat 응답의 concept_counting.quiz_ready_concepts가 트리거 역할을 하므로 합성하지 않음.
  const activeChatMessages = useMemo(() => {
    if (isDashboardBackendApiEnabled) return rawActiveChatMessages;
    if (!rawActiveChatMessages.length) return rawActiveChatMessages;
    const graphPreviewIndex = rawActiveChatMessages.findIndex(
      (message) => message.attachment?.type === "graph-preview"
    );
    if (graphPreviewIndex === -1) return rawActiveChatMessages;
    const syntheticId = `${activeChat?.id || "chat"}-mock-mini-quiz`;
    if (rawActiveChatMessages.some((message) => message.id === syntheticId)) {
      return rawActiveChatMessages;
    }
    const syntheticMessage = {
      id: syntheticId,
      role: "assistant",
      text: "지식 그래프에서 다룬 개념을 짧은 미니 퀴즈로 점검해볼까요?",
      miniQuizReady: MOCK_MINI_QUIZ_READY_CONCEPTS.map((concept) => ({
        nodeId: concept.node_id,
        name: concept.name,
      })),
    };
    return [
      ...rawActiveChatMessages.slice(0, graphPreviewIndex + 1),
      syntheticMessage,
      ...rawActiveChatMessages.slice(graphPreviewIndex + 1),
    ];
  }, [rawActiveChatMessages, activeChat?.id]);

  const visibleDeferredMiniQuizzes = useMemo(() => {
    if (!selectedProjectId) return [];
    return deferredMiniQuizzes.filter((item) => String(item.projectId) === String(selectedProjectId));
  }, [deferredMiniQuizzes, selectedProjectId]);

  useLayoutEffect(() => {
    if (previousDeferredMiniQuizCountRef.current === 0 && visibleDeferredMiniQuizzes.length > 0) {
      const { offset, dockSide } = getInitialMiniQuizFloatOffset();
      setMiniQuizFloatOffset(offset);
      setMiniQuizFloatDockSide(dockSide);
    }

    previousDeferredMiniQuizCountRef.current = visibleDeferredMiniQuizzes.length;
  }, [visibleDeferredMiniQuizzes.length]);

  useEffect(() => {
    if (!isDeferredMiniQuizListOpen) return undefined;

    updateMiniQuizDeferredPanelPlacement();
    window.addEventListener("resize", updateMiniQuizDeferredPanelPlacement);

    return () => {
      window.removeEventListener("resize", updateMiniQuizDeferredPanelPlacement);
    };
  }, [isDeferredMiniQuizListOpen, miniQuizFloatOffset, visibleDeferredMiniQuizzes.length]);

  useEffect(() => {
    if (visibleDeferredMiniQuizzes.length === 0) return undefined;

    function handleWindowResize() {
      clampMiniQuizFloatToViewport();
    }

    window.addEventListener("resize", handleWindowResize);

    return () => {
      window.removeEventListener("resize", handleWindowResize);
    };
  }, [miniQuizFloatOffset, visibleDeferredMiniQuizzes.length]);

  useEffect(() => {
    if (!isDeferredMiniQuizListOpen) return undefined;

    function handleOutsidePointerDown(event) {
      if (miniQuizFloatWrapRef.current?.contains(event.target)) {
        return;
      }

      setIsDeferredMiniQuizListOpen(false);
    }

    document.addEventListener("pointerdown", handleOutsidePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handleOutsidePointerDown);
    };
  }, [isDeferredMiniQuizListOpen]);

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

      let baseGraph;
      if (isDashboardBackendApiEnabled) {
        // 백엔드 모드에서는 mock/preset 그래프로 fallback하지 않음 — 진단 전 노드 없으면 빈 그래프 유지.
        baseGraph = buildBackendKnowledgeGraph(projectInput, backendGraph, recentChats, {
          strictBackend: true,
        });
      } else if (backendGraph) {
        baseGraph = buildBackendKnowledgeGraph(projectInput, backendGraph, recentChats);
      } else {
        baseGraph = buildProjectKnowledgeGraph(projectInput, recentChats);
      }

      return applyKnowledgeStagesToGraph(baseGraph, activeProjectData, workspaceState, {
        useBackendNodeState: isDashboardBackendApiEnabled,
      });
    },
    [activeProjectData, backendGraph, recentChats, workspaceState]
  );
  const updatedConcepts = useMemo(
    () =>
      recentGraphNodes.length
        ? recentGraphNodes.map((node) => getRecentGraphNodeDisplayLabel(node)).filter(Boolean).slice(0, 3)
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
      (node) => getRecentGraphNodeDisplayLabel(node).toLowerCase() === selectedUpdatedConceptLabel?.toLowerCase()
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
  const visibleGraphDetailQuizRecords = useMemo(
    () => buildGraphQuizRecords(activeProjectData, workspaceState, visibleGraphDetailNode),
    [activeProjectData, visibleGraphDetailNode, workspaceState]
  );
  // 현재 노드와 연관된 미니퀴즈 결과 — nodeId 또는 conceptName 일치 시 매칭 (mock 모드에서도 동작)
  const miniQuizResultsForVisibleNode = useMemo(() => {
    if (!visibleGraphDetailNode) return [];
    const nodeLabel = visibleGraphDetailNode.label || "";
    return miniQuizResults
      .filter(
        (item) =>
          item.nodeId === visibleGraphDetailNode.id ||
          (nodeLabel && item.conceptName === nodeLabel)
      )
      .map((item) => item.review);
  }, [miniQuizResults, visibleGraphDetailNode]);
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
  const selectedProjectMemo = useMemo(
    () => projectMemos.find((memo) => memo.memoId === selectedProjectMemoId) || null,
    [projectMemos, selectedProjectMemoId]
  );

  useEffect(() => {
    latestProjectMemoDraftRef.current = {
      memoId: selectedProjectMemoId,
      title: projectMemoTitle,
      content: projectMemoContent,
    };
  }, [projectMemoContent, projectMemoTitle, selectedProjectMemoId]);

  useEffect(() => {
    const projectId = activeProjectData?.projectId;

    if (!projectId) {
      setProjectMemos([]);
      setSelectedProjectMemoId(null);
      setProjectMemoTitle("");
      setProjectMemoContent("");
      setProjectMemoProjectId(null);
      setProjectMemoViewMode("list");
      setIsProjectMemoDirty(false);
      setIsProjectMemoSaving(false);
      setIsProjectMemoLoading(false);
      setProjectMemoError(null);
      setShowProjectMemoTitleWarning(false);
      setIsProjectMemoDeleteMode(false);
      setSelectedProjectMemoDeleteIds([]);
      return undefined;
    }

    let cancelled = false;

    setProjectMemoProjectId(projectId);
    setIsProjectMemoDirty(false);
    setIsProjectMemoSaving(false);
    setIsProjectMemoLoading(true);
    setProjectMemoError(null);

    async function loadProjectMemos() {
      try {
        const memos = await getProjectMemos(projectId);

        if (cancelled) {
          return;
        }

        setProjectMemos(sortProjectMemosByUpdatedAt(memos));
        setSelectedProjectMemoId(null);
        setProjectMemoTitle("");
        setProjectMemoContent("");
        setProjectMemoViewMode("list");
        setShowProjectMemoTitleWarning(false);
        setIsProjectMemoDeleteMode(false);
        setSelectedProjectMemoDeleteIds([]);
        latestProjectMemoDraftRef.current = {
          memoId: null,
          title: "",
          content: "",
        };
        setWorkspaceState(loadWorkspaceState());
      } catch (error) {
        if (!cancelled) {
          setProjectMemos([]);
          setSelectedProjectMemoId(null);
          setProjectMemoTitle("");
          setProjectMemoContent("");
          setProjectMemoViewMode("list");
          setShowProjectMemoTitleWarning(false);
          setIsProjectMemoDeleteMode(false);
          setSelectedProjectMemoDeleteIds([]);
          setProjectMemoError(error instanceof Error ? error.message : "프로젝트 메모를 불러오지 못했습니다.");
        }
      } finally {
        if (!cancelled) {
          setIsProjectMemoLoading(false);
        }
      }
    }

    loadProjectMemos();

    return () => {
      cancelled = true;
    };
  }, [activeProjectData?.projectId]);

  useEffect(() => {
    if (!chatLogRef.current || activeTab !== "chat" || !selectedChatId || !activeChat) {
      return;
    }

    if (newlyCreatedChatIdRef.current === selectedChatId) {
      newlyCreatedChatIdRef.current = null;
      return;
    }

    function scrollChatLogToBottom() {
      if (!chatLogRef.current) return;
      chatLogRef.current.scrollTop = chatLogRef.current.scrollHeight;
    }

    let secondFrameId = 0;
    const firstFrameId = window.requestAnimationFrame(() => {
      scrollChatLogToBottom();
      secondFrameId = window.requestAnimationFrame(scrollChatLogToBottom);
    });
    const timeoutId = window.setTimeout(scrollChatLogToBottom, 120);

    return () => {
      window.cancelAnimationFrame(firstFrameId);
      if (secondFrameId) {
        window.cancelAnimationFrame(secondFrameId);
      }
      window.clearTimeout(timeoutId);
    };
  }, [activeChat, activeChatScrollKey, activeTab, selectedChatId, selectedProjectId]);

  useEffect(() => {
    if (!selectedProjectId) {
      setDeferredMiniQuizzes([]);
      return undefined;
    }

    const storedDeferredMiniQuizzes = loadProjectMiniQuizDeferred(selectedProjectId);
    setDeferredMiniQuizzes(storedDeferredMiniQuizzes);

    if (!isMiniQuizBackendApiEnabled) {
      return undefined;
    }

    let cancelled = false;

    (async () => {
      try {
        const response = await getApiDeferredMiniQuizzes(selectedProjectId);
        if (cancelled) return;
        const backendDeferredMiniQuizzes = normalizeDeferredMiniQuizApiResponse(response, selectedProjectId);
        const nextDeferredMiniQuizzes = dedupeDeferredMiniQuizzes([
          ...storedDeferredMiniQuizzes,
          ...backendDeferredMiniQuizzes,
        ]);
        setDeferredMiniQuizzes(nextDeferredMiniQuizzes);
        saveProjectMiniQuizDeferred(selectedProjectId, nextDeferredMiniQuizzes);
      } catch (error) {
        if (!cancelled) {
          console.error(error);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedProjectId]);

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
      setGraphFocusNodeId(null);
      setGraphDetailNodeId(null);
      setVisibleGraphDetailNodeId(null);
      setGraphNodeDetail(null);
      setExplanationError(null);
      setIsReportGraphOpen(false);
      setSelectedReportGraphNodeId(null);
    } else {
      setSelectedGraphNodeId(null);
      setGraphDetailNodeId(null);
      setVisibleGraphDetailNodeId(null);
      setGraphFocusNodeId(null);
      setGraphNodeDetail(null);
      setExplanationError(null);
      setIsReportGraphOpen(false);
      setSelectedReportGraphNodeId(null);
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
      setGraphFocusNodeId(null);
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

      if (isReportGraphOpen) {
        setIsReportGraphOpen(false);
        setSelectedReportGraphNodeId(null);
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
  }, [activeTab, isCreateOpen, isGraphSearchOpen, isReportGraphOpen]);

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
    if (projectId !== selectedProjectId) {
      setRecentChats([]);
      setBackendGraph(null);
      setRecentGraphNodes([]);
      setSelectedGraphNodeId(null);
      setGraphFocusNodeId(null);
      setGraphDetailNodeId(null);
      setVisibleGraphDetailNodeId(null);
    }

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
      setRecentChats([]);
      setBackendGraph(null);
      setRecentGraphNodes([]);
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

  async function handleDeleteProject(project) {
    if (!project) {
      return;
    }

    const confirmed = window.confirm(`'${project.title || "프로젝트"}' 프로젝트를 삭제할까요?`);
    if (!confirmed) {
      return;
    }

    try {
      setProjectError(null);
      setChatError(null);
      await deleteProject(project.id);
      const [nextProjects, nextCatalogOptions] = await Promise.all([getProjects(), getProjectCatalogOptions()]);
      const selectedCatalogOptionIds = new Set(getSelectedCatalogOptionIds(nextProjects));
      const deletedSelectedProject = selectedProjectId === project.id;
      const nextSelectedProjectId = deletedSelectedProject
        ? nextProjects[0]?.id || null
        : nextProjects.some((item) => item.id === selectedProjectId)
          ? selectedProjectId
          : nextProjects[0]?.id || null;

      setProjects(nextProjects);
      setCatalogOptions(nextCatalogOptions);
      setSelectedProjectId(nextSelectedProjectId);
      setSelectedChatId(null);
      setRecentChats([]);
      setBackendGraph(null);
      setRecentGraphNodes([]);
      setSelectedCatalogOptionId(nextCatalogOptions.find((option) => !selectedCatalogOptionIds.has(option.id))?.id || null);
      setIsProjectListExpanded(false);
      setWorkspaceState(loadWorkspaceState());
    } catch (error) {
      setProjectError(error instanceof Error ? error.message : "프로젝트를 삭제하지 못했습니다.");
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
      newlyCreatedChatIdRef.current = nextChat.id;
      setSelectedChatId(nextChat.id);
      setActiveTab("chat");
      setWorkspaceState(loadWorkspaceState());
    } catch (error) {
      setChatError(error instanceof Error ? error.message : "새 채팅을 생성하지 못했습니다.");
    }
  }

  async function handleDeleteChat(chat) {
    if (!selectedProjectId || !chat) {
      return;
    }

    const confirmed = window.confirm(`'${chat.title || "채팅방"}' 채팅방을 삭제할까요?`);
    if (!confirmed) {
      return;
    }

    try {
      setChatError(null);
      await removeChat(selectedProjectId, chat.id);
      const nextChats = await getProjectChats(selectedProjectId);

      setRecentChats(nextChats);
      setSelectedChatId((currentChatId) => {
        if (currentChatId && currentChatId !== chat.id && nextChats.some((item) => item.id === currentChatId)) {
          return currentChatId;
        }

        return nextChats[0]?.id || null;
      });
      setWorkspaceState(loadWorkspaceState());
    } catch (error) {
      setChatError(error instanceof Error ? error.message : "채팅방을 삭제하지 못했습니다.");
    }
  }

  async function handleSendMessage(event) {
    event.preventDefault();

    const nextMessage = composerText.trim();

    if (!selectedProjectId || !nextMessage || isSendingMessage) {
      return;
    }

    let pendingChatId = selectedChatId || recentChats[0]?.id || null;

    if (isDashboardBackendApiEnabled && !pendingChatId) {
      setIsSendingMessage(true);
      setChatError(null);

      try {
        const nextChat = await createChat(selectedProjectId);
        pendingChatId = nextChat.id;
        newlyCreatedChatIdRef.current = nextChat.id;
        setSelectedChatId(nextChat.id);
        setRecentChats((currentChats) => [nextChat, ...currentChats.filter((chat) => chat.id !== nextChat.id)]);
      } catch (error) {
        setChatError(error instanceof Error ? error.message : "새 채팅방을 생성하지 못했습니다.");
        setIsSendingMessage(false);
        return;
      }
    }

    if (!pendingChatId) {
      pendingChatId = `${selectedProjectId}-api-thread`;
    }

    const now = new Date().toISOString();
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

    if (!isDashboardBackendApiEnabled && nextMessage === ",") {
      updateDeferredMiniQuizzes((current) =>
        current.filter((item) => String(item.projectId) !== String(selectedProjectId))
      );
      setIsDeferredMiniQuizListOpen(false);
      setMiniQuizFloatOffset({ x: 0, y: 0 });
      setMiniQuizFloatDockSide("right");
      setRecentChats((currentChats) =>
        currentChats.map((chat) =>
          chat.id === pendingChatId
            ? {
                ...chat,
                messages: chat.messages.filter(
                  (message) => message.id !== pendingUserMessage.id && message.id !== pendingAssistantMessage.id
                ),
              }
            : chat
        )
      );
      setIsSendingMessage(false);
      return;
    }

    if (!isDashboardBackendApiEnabled && nextMessage === ".") {
      const debugMiniQuizReady = MOCK_MINI_QUIZ_READY_CONCEPTS.map((concept) => ({
        nodeId: concept.node_id,
        name: concept.name,
        useMockMiniQuiz: true,
      }));

      setRecentChats((currentChats) =>
        currentChats.map((chat) =>
          chat.id === pendingChatId
            ? {
                ...chat,
                messages: chat.messages.map((message) =>
                  message.id === pendingAssistantMessage.id
                    ? {
                        ...message,
                        text: "디버깅용 mock 미니퀴즈를 준비했습니다.",
                        isPending: false,
                        miniQuizReady: debugMiniQuizReady,
                      }
                    : message
                ),
              }
            : chat
        )
      );
      setIsSendingMessage(false);
      return;
    }

    try {
      const sendResponse = await sendChatMessage(selectedProjectId, pendingChatId, nextMessage);
      // 정책: 현재 미니퀴즈 트리거 UI는 concept_counting.quiz_ready_concepts를 기준으로 유지한다.
      // mini_quiz_trigger/grounding은 별도 UI 기획이 생기면 연결한다.
      const quizReady = Array.isArray(sendResponse?.concept_counting?.quiz_ready_concepts)
        ? sendResponse.concept_counting.quiz_ready_concepts
        : [];
      const [nextProjects, nextChats, nextGraph, nextRecentGraphNodes] = await Promise.all([
        getProjects(),
        getProjectChats(selectedProjectId),
        getProjectGraphData(selectedProjectId).catch(() => null),
        getRecentGraphNodes(selectedProjectId).catch(() => []),
      ]);

      if (quizReady.length && sendResponse?.chat_id !== undefined) {
        const assistantMessageId = `api-chat-${sendResponse.chat_id}-assistant`;
        updateMiniQuizReadyByMessage((current) => ({
          ...current,
          [assistantMessageId]: quizReady.map((concept) => ({
            nodeId: concept.node_id,
            name: concept.name,
          })),
        }));
      }

      setProjects(nextProjects);
      setRecentChats(nextChats);
      setBackendGraph(nextGraph);
      setRecentGraphNodes(nextRecentGraphNodes);
      setSelectedChatId(nextChats.some((chat) => chat.id === pendingChatId) ? pendingChatId : nextChats[0]?.id || null);
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

  function applyProjectMemoDraft(memo) {
    setSelectedProjectMemoId(memo?.memoId || null);
    setProjectMemoTitle(memo?.title || "");
    setProjectMemoContent(memo?.content || "");
    setProjectMemoViewMode("editor");
    setShowProjectMemoTitleWarning(false);
    setProjectMemoTitleWarningMessage("제목을 정해주세요");
    setIsProjectMemoTitleShaking(false);
    latestProjectMemoDraftRef.current = {
      memoId: memo?.memoId || null,
      title: memo?.title || "",
      content: memo?.content || "",
    };
    setIsProjectMemoDirty(false);
  }

  async function handleProjectMemoSelect(memoId) {
    if (isProjectMemoDeleteMode) {
      setSelectedProjectMemoDeleteIds((currentIds) =>
        currentIds.includes(memoId) ? currentIds.filter((id) => id !== memoId) : [...currentIds, memoId]
      );
      return;
    }

    if (memoId === selectedProjectMemoId) {
      return;
    }

    const memo = projectMemos.find((item) => item.memoId === memoId) || null;
    applyProjectMemoDraft(memo);
  }

  async function handleCreateProjectMemo() {
    const projectId = activeProjectData?.projectId;

    if (!projectId) {
      return;
    }

    setProjectMemoError(null);
    setSelectedProjectMemoId(null);
    setProjectMemoTitle("");
    setProjectMemoContent("");
    setProjectMemoProjectId(projectId);
    setProjectMemoViewMode("editor");
    setIsProjectMemoDirty(false);
    setShowProjectMemoTitleWarning(false);
    setProjectMemoTitleWarningMessage("제목을 정해주세요");
    setIsProjectMemoTitleShaking(false);
    latestProjectMemoDraftRef.current = {
      memoId: null,
      title: "",
      content: "",
    };
  }

  function handleProjectMemoListOpen() {
    setProjectMemoViewMode("list");
    setSelectedProjectMemoId(null);
    setProjectMemoTitle("");
    setProjectMemoContent("");
    setProjectMemoError(null);
    setShowProjectMemoTitleWarning(false);
    setProjectMemoTitleWarningMessage("제목을 정해주세요");
    setIsProjectMemoTitleShaking(false);
    setIsProjectMemoDeleteMode(false);
    setSelectedProjectMemoDeleteIds([]);
    latestProjectMemoDraftRef.current = {
      memoId: null,
      title: "",
      content: "",
    };
  }

  function handleProjectMemoTitleChange(title) {
    if (!activeProjectData?.projectId || projectMemoViewMode !== "editor") {
      return;
    }

    setProjectMemoTitle(title);
    setProjectMemoProjectId(activeProjectData.projectId);
    if (title.trim()) {
      setShowProjectMemoTitleWarning(false);
    }
    setIsProjectMemoTitleShaking(false);
    setIsProjectMemoDirty(true);
  }

  function handleProjectMemoContentChange(content) {
    if (!activeProjectData?.projectId || projectMemoViewMode !== "editor") {
      return;
    }

    setProjectMemoContent(content);
    setProjectMemoProjectId(activeProjectData.projectId);
    setIsProjectMemoDirty(true);
  }

  function handleProjectMemoDeleteModeOpen() {
    if (!projectMemos.length || isProjectMemoDeleting) {
      return;
    }

    if (isProjectMemoDeleteMode) {
      setIsProjectMemoDeleteMode(false);
      setSelectedProjectMemoDeleteIds([]);
      return;
    }

    setIsProjectMemoDeleteMode(true);
    setSelectedProjectMemoDeleteIds([]);
    setProjectMemoError(null);
  }

  function handleProjectMemoDeleteToggle(memoId) {
    setSelectedProjectMemoDeleteIds((currentIds) =>
      currentIds.includes(memoId) ? currentIds.filter((id) => id !== memoId) : [...currentIds, memoId]
    );
  }

  async function handleConfirmProjectMemoDelete() {
    const projectId = activeProjectData?.projectId || projectMemoProjectId;

    if (!projectId) {
      return;
    }

    if (!selectedProjectMemoDeleteIds.length) {
      setIsProjectMemoDeleteMode(false);
      return;
    }

    setIsProjectMemoDeleting(true);
    setProjectMemoError(null);

    try {
      for (const memoId of selectedProjectMemoDeleteIds) {
        await deleteProjectMemo(projectId, memoId);
      }

      const memos = await getProjectMemos(projectId);

      setProjectMemos(sortProjectMemosByUpdatedAt(memos));
      setSelectedProjectMemoDeleteIds([]);
      setIsProjectMemoDeleteMode(false);
      setWorkspaceState(loadWorkspaceState());
    } catch (error) {
      setProjectMemoError(error instanceof Error ? error.message : "프로젝트 메모를 삭제하지 못했습니다.");
    } finally {
      setIsProjectMemoDeleting(false);
    }
  }

  async function handleSaveProjectMemo() {
    const projectId = projectMemoProjectId || activeProjectData?.projectId;
    const title = projectMemoTitle.trim();

    if (!projectId || projectMemoViewMode !== "editor") {
      return;
    }

    if (!title) {
      setProjectMemoTitleWarningMessage("제목을 정해주세요");
      setShowProjectMemoTitleWarning(true);
      setIsProjectMemoTitleShaking(true);
      window.setTimeout(() => setIsProjectMemoTitleShaking(false), 420);
      return;
    }

    const normalizedTitle = title.toLowerCase();
    const hasDuplicateTitle = projectMemos.some(
      (memo) => memo.memoId !== selectedProjectMemoId && memo.title.trim().toLowerCase() === normalizedTitle
    );

    if (hasDuplicateTitle) {
      setShowProjectMemoTitleWarning(false);
      setIsProjectMemoTitleShaking(true);
      window.setTimeout(() => setIsProjectMemoTitleShaking(false), 420);
      return;
    }

    setIsProjectMemoSaving(true);
    setShowProjectMemoTitleWarning(false);
    setProjectMemoError(null);

    try {
      if (selectedProjectMemoId) {
        await updateProjectMemo(projectId, selectedProjectMemoId, {
          title,
          content: projectMemoContent,
        });
      } else {
        await createProjectMemo(projectId, {
          title,
          content: projectMemoContent,
        });
      }

      const memos = await getProjectMemos(projectId);

      setProjectMemos(sortProjectMemosByUpdatedAt(memos));
      setSelectedProjectMemoId(null);
      setProjectMemoTitle("");
      setProjectMemoContent("");
      setProjectMemoViewMode("list");
      setIsProjectMemoDirty(false);
      latestProjectMemoDraftRef.current = {
        memoId: null,
        title: "",
        content: "",
      };
      setWorkspaceState(loadWorkspaceState());
    } catch (error) {
      setProjectMemoError(error instanceof Error ? error.message : "프로젝트 메모를 저장하지 못했습니다.");
    } finally {
      setIsProjectMemoSaving(false);
    }
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
    setIsGraphNodeQuizHistoryLoading(true);
    setGraphNodeQuizHistory([]);

    try {
      const [detail, history] = await Promise.all([
        getGraphNodeDetail(nodeId),
        getGraphNodeQuizHistory(nodeId).catch(() => []),
      ]);
      setGraphNodeDetail(detail);
      setGraphNodeQuizHistory(Array.isArray(history) ? history : []);
    } catch {
      setGraphNodeDetail(null);
      setGraphNodeQuizHistory([]);
    } finally {
      setIsGraphNodeDetailLoading(false);
      setIsGraphNodeQuizHistoryLoading(false);
    }
  }

  function handleResetGraphView() {
    setGraphResetKey((current) => current + 1);
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
        explanationStyle: profile.explanationStyle,
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

  async function openMiniQuizFromTriggers(messageId, triggers) {
    const safeTriggers = Array.isArray(triggers) ? triggers : [];
    if (!safeTriggers.length || !selectedProjectId || miniQuizOpeningRef.current) {
      return;
    }

    const shouldUseMockQuiz = safeTriggers.some((target) => target.useMockMiniQuiz);
    const requestId = miniQuizOpenRequestIdRef.current + 1;
    miniQuizOpenRequestIdRef.current = requestId;
    miniQuizOpeningRef.current = true;
    setOpeningMiniQuizMessageId(messageId);

    if (isMiniQuizBackendApiEnabled && !shouldUseMockQuiz) {
      try {
        const responses = await Promise.all(
          safeTriggers.map((target) =>
            generateApiMiniQuizQuestion(selectedProjectId, target.nodeId).then((response) => ({
              target,
              response,
            }))
          )
        );
        const queue = responses.flatMap(({ target, response }) =>
          buildMiniQuizQueueFromQuestionPayload(response, target)
        );

        if (!queue.length) {
          throw new Error("생성된 미니퀴즈가 없습니다.");
        }

        if (miniQuizOpenRequestIdRef.current !== requestId) {
          return;
        }

        setActiveMiniQuiz({
          projectId: selectedProjectId,
          queue,
          sourceMessageId: messageId,
        });
      } catch (error) {
        console.error(error);
      } finally {
        if (miniQuizOpenRequestIdRef.current === requestId) {
          miniQuizOpeningRef.current = false;
          setOpeningMiniQuizMessageId(null);
        }
      }
      return;
    }

    try {
      if (miniQuizOpenRequestIdRef.current !== requestId) {
        return;
      }

      setActiveMiniQuiz({
        projectId: selectedProjectId,
        queue: safeTriggers.map((target) => ({
          nodeId: target.nodeId,
          name: target.name,
          useMockMiniQuiz: Boolean(target.useMockMiniQuiz),
        })),
        sourceMessageId: messageId,
      });
    } finally {
      if (miniQuizOpenRequestIdRef.current === requestId) {
        miniQuizOpeningRef.current = false;
        setOpeningMiniQuizMessageId(null);
      }
    }
  }

  function buildMiniQuizResultMessages(results, targetChatId) {
    if (!targetChatId || !Array.isArray(results)) {
      return [];
    }

    const resultMessages = [];
    const seenMessageIds = new Set();
    results.forEach((entry, index) => {
      const backendResult = entry?.backendResult || entry?.result || {};
      const resultMessage = backendResult?.result_message || null;
      const text = buildMiniQuizResultDisplayText(entry);

      if (!text) {
        return;
      }

      const messageId =
        resultMessage.chat_id !== undefined && resultMessage.chat_id !== null
          ? `api-chat-${resultMessage.chat_id}-assistant`
          : `${targetChatId}-mini-quiz-result-${entry?.currentTarget?.nodeId || index}`;

      if (seenMessageIds.has(messageId)) {
        return;
      }

      seenMessageIds.add(messageId);
      resultMessages.push({ id: messageId, chatId: resultMessage.chat_id, text });
    });

    if (!resultMessages.length) {
      return [];
    }

    const firstMessage = resultMessages[0];
    const lastMessage = resultMessages[resultMessages.length - 1];
    const hasBackendChatIds =
      firstMessage.chatId !== undefined &&
      firstMessage.chatId !== null &&
      lastMessage.chatId !== undefined &&
      lastMessage.chatId !== null;

    return [
      {
        id:
          resultMessages.length === 1
            ? firstMessage.id
            : hasBackendChatIds
              ? `api-chat-mini-quiz-result-${firstMessage.chatId}-${lastMessage.chatId}`
              : `${targetChatId}-mini-quiz-result-${firstMessage.id}-${lastMessage.id}`,
        role: "assistant",
        text: resultMessages.map((message) => message.text).join("\n\n---\n\n"),
        variant: "mini-quiz-result",
      },
    ];
  }

  function appendMiniQuizResultMessagesToChat(chats, targetChatId, results) {
    const resultMessages = buildMiniQuizResultMessages(results, targetChatId);
    if (!resultMessages.length) {
      return chats;
    }

    const existingChat = chats.find((chat) => chat.id === targetChatId) || activeChat;
    if (!existingChat) {
      return chats;
    }

    const existingMessageIds = new Set(existingChat.messages.map((message) => message.id));
    const nextMessages = resultMessages.filter((message) => !existingMessageIds.has(message.id));
    if (!nextMessages.length) {
      return chats;
    }

    const nextChat = {
      ...existingChat,
      updatedAt: new Date().toISOString(),
      messages: [...existingChat.messages, ...nextMessages],
    };

    return [nextChat, ...chats.filter((chat) => chat.id !== nextChat.id)];
  }

  const workspaceHeading = activeProjectData
    ? activeChat?.title
      ? `${activeProjectData.title} - ${activeChat.title}`
      : activeProjectData.title
    : "프로젝트를 선택해주세요";
  function getAssistantMessageText(message) {
    if (miniQuizCompletedByMessage[message.id]) {
      return "미니 퀴즈를 모두 마쳤습니다. 결과를 바탕으로 다음 학습을 이어가볼게요.";
    }

    const overriddenMiniQuizReady = miniQuizReadyByMessage[message.id];
    const hasOriginalMiniQuizReady = Array.isArray(message.miniQuizReady) && message.miniQuizReady.length > 0;
    const isMiniQuizDeferred =
      hasOriginalMiniQuizReady &&
      Array.isArray(overriddenMiniQuizReady) &&
      overriddenMiniQuizReady.length === 0;

    return isMiniQuizDeferred ? "적절한 진단을 위해서는 미니퀴즈를 꼭 풀어야 합니다." : message.text;
  }
  const visibleGraphDetailDescription =
    graphNodeDetail?.node_id === visibleGraphDetailNode?.id && graphNodeDetail?.description
      ? graphNodeDetail.description
      : visibleGraphDetailNode?.description || "";
  const visibleNodeExplanation = visibleGraphDetailNode ? nodeExplanations[visibleGraphDetailNode.id] : "";
  const visibleGraphKnowledgeStageIndex = visibleGraphDetailNode?.knowledgeStageIndex ?? 0;
  const visibleGraphKnowledgeStageLabel =
    visibleGraphDetailNode?.knowledgeStageLabel ||
    knowledgeStageLabels[visibleGraphKnowledgeStageIndex] ||
    knowledgeStageLabels[0];
  const visibleGraphKnowledgeStageColor = getKnowledgeStageColor(visibleGraphKnowledgeStageIndex);

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
            onDeleteProject={handleDeleteProject}
            isLoading={isProjectsLoading}
            error={projectError}
          />

          <RecentChatList
            chats={recentChats}
            selectedChatId={selectedChatId}
            onSelect={setSelectedChatId}
            onCreateChat={handleCreateChat}
            onDeleteChat={handleDeleteChat}
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
          <section className="workspace-chat-stage" ref={chatStageRef}>
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
                  }${message.variant ? ` workspace-message-${message.variant}` : ""
                  }`}
                >
                  {message.role === "assistant" ? (
                    message.isPending ? (
                      <div className="workspace-message-pending-indicator" role="status" aria-label="AI 응답 생성 중">
                        <div className="workspace-message-loading-dots" aria-hidden="true">
                          <span />
                          <span />
                          <span />
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="workspace-message-head">
                          <span className="workspace-message-badge">
                            <EeumIcon
                              className="workspace-message-badge-icon"
                              variant="sparkle"
                            />
                            <span>이음 AI</span>
                          </span>
                        </div>
                        <div className="workspace-message-bubble">
                          {message.variant === "diagnosis-report" ? (
                            <DiagnosisMessageBody message={message} />
                          ) : (
                            <MarkdownMessageBody content={getAssistantMessageText(message)} />
                          )}
                          {(() => {
                            if (miniQuizCompletedByMessage[message.id]) return null;
                            const overridden = miniQuizReadyByMessage[message.id];
                            const triggers =
                              overridden !== undefined ? overridden : message.miniQuizReady || null;
                            if (!triggers || triggers.length === 0) return null;
                            const isOpeningThisMiniQuiz = openingMiniQuizMessageId === message.id;
                            return (
                              <div className="workspace-message-mini-quiz">
                                <div className="workspace-message-mini-quiz-label">
                                  <strong>시험 준비가 되었습니다</strong>
                                  <span>
                                    {triggers.length > 1
                                      ? `${triggers.length}개 개념의 미니 퀴즈를 풀어볼까요?`
                                      : `${triggers[0].name} 미니 퀴즈를 풀어볼까요?`}
                                  </span>
                                </div>
                                <div className="workspace-message-mini-quiz-actions">
                                  <button
                                    type="button"
                                    className="workspace-message-mini-quiz-action workspace-message-mini-quiz-action-primary"
                                    onClick={() => openMiniQuizFromTriggers(message.id, triggers)}
                                    disabled={Boolean(openingMiniQuizMessageId)}
                                  >
                                    {isOpeningThisMiniQuiz ? "준비 중..." : "퀴즈 풀기"}
                                  </button>
                                  <button
                                    type="button"
                                    className="workspace-message-mini-quiz-action workspace-message-mini-quiz-action-secondary"
                                    disabled={Boolean(openingMiniQuizMessageId)}
                                    onClick={async () => {
                                      const messageId = message.id;
                                      const shouldUseMockDeferred = triggers.some((target) => target.useMockMiniQuiz);

                                      if (isMiniQuizBackendApiEnabled && selectedProjectId && !shouldUseMockDeferred) {
                                        // 백엔드 ground truth — defer가 실패한 항목은 로컬에도 추가하지 않는다.
                                        // 실패 시 trigger 버튼도 그대로 유지해 재시도할 수 있도록 한다.
                                        const results = await Promise.all(
                                          triggers.map((target) =>
                                            deferApiMiniQuizQuestion(selectedProjectId, target.nodeId, target.group?.questionIds)
                                              .then((response) => ({ target, response, error: null }))
                                              .catch((error) => ({ target, response: null, error }))
                                          )
                                        );

                                        const successResults = results.filter((entry) => !entry.error && entry.response);
                                        const failedTargets = results
                                          .filter((entry) => entry.error || !entry.response)
                                          .map((entry) => entry.target);

                                        if (successResults.length) {
                                          updateDeferredMiniQuizzes((current) => {
                                            const existingKeys = new Set(
                                              current.map((item) => getDeferredMiniQuizDedupeKey(item)).filter(Boolean)
                                            );
                                            const additions = successResults
                                              .map(({ target, response }) => {
                                                const group = {
                                                  ...(response.group || {}),
                                                  node_id: response.group?.node_id || target.nodeId,
                                                  node_name: response.group?.node_name || target.name,
                                                  questions: response.questions,
                                                  deferred_at: Date.now(),
                                                };
                                                return normalizeDeferredMiniQuizGroup(group, selectedProjectId);
                                              })
                                              .filter((item) => {
                                                if (!item) return false;
                                                const key =
                                                  getDeferredMiniQuizDedupeKey(item) || (item.nodeId ? `node:${item.nodeId}` : null);
                                                if (!key) return false;
                                                if (existingKeys.has(key)) return false;
                                                existingKeys.add(key);
                                                return true;
                                              });
                                            return [...current, ...additions];
                                          });
                                        }

                                        if (failedTargets.length) {
                                          // 실패한 노드는 trigger에 남겨 사용자가 재시도하도록 한다.
                                          updateMiniQuizReadyByMessage((current) => ({
                                            ...current,
                                            [messageId]: failedTargets,
                                          }));
                                        } else {
                                          updateMiniQuizReadyByMessage((current) => ({
                                            ...current,
                                            [messageId]: [],
                                          }));
                                        }
                                      } else {
                                        // mock 모드: 백엔드 의존이 없으므로 로컬에 그대로 적재.
                                        updateDeferredMiniQuizzes((current) => {
                                          const existingNodeIds = new Set(current.map((item) => item.nodeId));
                                          const additions = triggers
                                            .map((target) => ({
                                              id: `${messageId}-${target.nodeId}`,
                                              deferredId: null,
                                              nodeId: target.nodeId,
                                              name: target.name,
                                              projectId: selectedProjectId,
                                              deferredAt: Date.now(),
                                              presetQuestion: null,
                                              useMockMiniQuiz: Boolean(target.useMockMiniQuiz),
                                            }))
                                            .filter((item) => !existingNodeIds.has(item.nodeId));
                                          return [...current, ...additions];
                                        });
                                        updateMiniQuizReadyByMessage((current) => ({
                                          ...current,
                                          [messageId]: [],
                                        }));
                                      }
                                    }}
                                  >
                                    나중에 보기
                                  </button>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                        {message.attachment?.type === "graph-preview" ? (
                          <ReportGraphPreview
                            graph={projectGraph}
                            projectTitle={activeProjectData?.title || null}
                            onOpen={() => {
                              setSelectedReportGraphNodeId(projectGraph.defaultSelectedNodeId || null);
                              setIsReportGraphOpen(true);
                            }}
                          />
                        ) : null}
                      </>
                    )
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

            {visibleDeferredMiniQuizzes.length > 0 ? (
              <motion.div
                ref={miniQuizFloatWrapRef}
                className={`workspace-mini-quiz-float-wrap workspace-mini-quiz-float-wrap-${miniQuizFloatDockSide}${
                  isMiniQuizFloatDragging ? " workspace-mini-quiz-float-wrap-dragging" : ""
                }`}
                style={{
                  "--mini-quiz-float-x": `${miniQuizFloatOffset.x}px`,
                  "--mini-quiz-float-y": `${miniQuizFloatOffset.y}px`,
                }}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{
                  duration: 0.4,
                  scale: { type: "spring", visualDuration: 0.4, bounce: 0.5 },
                }}
              >
                <button
                  type="button"
                  className="workspace-mini-quiz-float-button"
                  aria-label="미뤄둔 미니퀴즈"
                  onPointerDown={handleMiniQuizFloatPointerDown}
                  onClick={handleMiniQuizFloatClick}
                >
                  <span className="workspace-mini-quiz-float-icon" aria-hidden="true">
                    <img src="/icons/dashboard/quiz.svg" alt="" />
                  </span>
                  <span className="workspace-mini-quiz-float-count">{visibleDeferredMiniQuizzes.length}</span>
                </button>

                {isDeferredMiniQuizListOpen ? (
                  <div
                    className={`workspace-mini-quiz-deferred-panel workspace-mini-quiz-deferred-panel-${miniQuizDeferredPanelPlacement}`}
                    role="dialog"
                    aria-label="미뤄둔 미니퀴즈 목록"
                  >
                    <div className="workspace-mini-quiz-deferred-head">
                      <strong>미뤄둔 미니퀴즈</strong>
                      <span>{visibleDeferredMiniQuizzes.length}개</span>
                    </div>
                    <ul className="workspace-mini-quiz-deferred-list">
                      {visibleDeferredMiniQuizzes.map((item, index) => (
                        <li
                          key={item.id}
                          className="workspace-mini-quiz-deferred-list-row"
                          style={{ animationDelay: `${index * 55}ms` }}
                        >
                          <button
                            type="button"
                            className="workspace-mini-quiz-deferred-item"
                            onClick={() => {
                              setActiveMiniQuiz({
                                projectId: item.projectId || selectedProjectId,
                                nodeId: item.nodeId,
                                name: item.name,
                                queue: Array.isArray(item.queue) && item.queue.length
                                  ? item.queue
                                  : [
                                      {
                                        nodeId: item.nodeId,
                                        name: item.name,
                                        presetQuestion: item.presetQuestion || null,
                                        useMockMiniQuiz: Boolean(item.useMockMiniQuiz),
                                      },
                                    ],
                                sourceMessageId: null,
                                deferredId: item.id,
                                deferredKey: getDeferredMiniQuizDedupeKey(item),
                                groupId: item.groupId,
                              });
                              setIsDeferredMiniQuizListOpen(false);
                            }}
                          >
                            <span className="workspace-mini-quiz-deferred-dot" aria-hidden="true" />
                            <span className="workspace-mini-quiz-deferred-name">{item.name}</span>
                            <span className="workspace-mini-quiz-deferred-cta">풀기 →</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </motion.div>
            ) : null}

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
                        nodeSizeScale={0.7}
                        selectedNodeId={selectedGraphNodeId}
                        onNodeSelect={handleGraphNodeSelect}
                        focusNodeId={graphFocusNodeId}
                        resetViewKey={graphResetKey}
                        autoFitDuration={0}
                      />

                      <div className="workspace-graph-stage-legend" aria-label="이해도 단계 색상">
                        {knowledgeStageLabels.map((label, index) => (
                          <div key={label} className="workspace-graph-stage-legend-item">
                            <span
                              className="workspace-graph-stage-legend-dot"
                              style={{ backgroundColor: getKnowledgeStageColor(index) }}
                            />
                            <b>-</b>
                            <strong>{label}</strong>
                          </div>
                        ))}
                      </div>

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
                          {visibleGraphDetailNode.isProjectRoot ? null : (
                            <span
                              className="workspace-graph-detail-stage-badge"
                              style={{
                                backgroundColor: `${visibleGraphKnowledgeStageColor}24`,
                                color: visibleGraphKnowledgeStageColor,
                              }}
                            >
                              현재 이해도 : {visibleGraphKnowledgeStageLabel}
                            </span>
                          )}
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
                              <button
                                key={topic.id}
                                type="button"
                                className="workspace-graph-related-item workspace-graph-related-item-button"
                                onClick={() => {
                                  handleGraphNodeSelect(topic.id);
                                  requestGraphFocus(topic.id);
                                }}
                              >
                                <span
                                  className="workspace-graph-related-dot"
                                  style={{ background: topic.color }}
                                />
                                <span>{topic.label}</span>
                              </button>
                            ))
                          ) : (
                            <div className="workspace-graph-empty-copy">연결된 관련 개념이 없습니다.</div>
                          )}
                        </div>
                      </section>

                      <section className="workspace-resource-section">
                        <h2>풀이 이력</h2>
                        <div className="workspace-graph-history-list">
                          {(() => {
                            if (isGraphNodeQuizHistoryLoading) {
                              return (
                                <div className="workspace-graph-empty-copy">풀이 이력을 불러오는 중입니다.</div>
                              );
                            }

                            // 백엔드 quiz-history 와 프론트에서 즉시 합성한 미니퀴즈 결과 dedup.
                            const backendQuestionIds = new Set(
                              graphNodeQuizHistory.map((entry) => entry.question_id)
                            );
                            const combinedHistory = [
                              ...graphNodeQuizHistory,
                              ...miniQuizResultsForVisibleNode.filter(
                                (entry) => !backendQuestionIds.has(entry.question_id)
                              ),
                            ];

                            const renderBackendStyle = (entry) => {
                              return (
                                <button
                                  key={entry.question_id}
                                  type="button"
                                  className="workspace-graph-history-item workspace-graph-history-item-clickable"
                                  onClick={() =>
                                    setActiveQuizReview({
                                      entry,
                                      conceptName: visibleGraphDetailNode?.label || null,
                                    })
                                  }
                                >
                                  <strong>{entry.question}</strong>
                                </button>
                              );
                            };

                            const renderMockStyle = (entry) => {
                              return (
                                <button
                                  key={entry.id}
                                  type="button"
                                  className="workspace-graph-history-item workspace-graph-history-item-clickable"
                                  onClick={() =>
                                    entry.reviewEntry
                                      ? setActiveQuizReview({
                                          entry: entry.reviewEntry,
                                          conceptName: visibleGraphDetailNode?.label || null,
                                        })
                                      : null
                                  }
                                >
                                  <strong>{entry.prompt}</strong>
                                </button>
                              );
                            };

                            if (combinedHistory.length || visibleGraphDetailQuizRecords.length) {
                              return (
                                <>
                                  {combinedHistory.map(renderBackendStyle)}
                                  {combinedHistory.length === 0
                                    ? visibleGraphDetailQuizRecords.map(renderMockStyle)
                                    : null}
                                </>
                              );
                            }

                            return (
                              <div className="workspace-graph-empty-copy">아직 풀이 이력이 없습니다.</div>
                            );
                          })()}
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
                <div className="workspace-empty-copy workspace-concept-empty">최근 업데이트된 개념이 없습니다.</div>
              )}
            </div>
          </section>

          <section
            className={`workspace-resource-section workspace-resource-section-memo workspace-resource-section-memo-${projectMemoViewMode}`}
          >
            <div className="workspace-memo-toolbar">
              <h2>메모장</h2>
              {projectMemoViewMode === "editor" ? (
                <div className="workspace-memo-toolbar-actions">
                  <button
                    type="button"
                    className="workspace-memo-list-button"
                    onClick={handleProjectMemoListOpen}
                    disabled={isProjectMemoSaving}
                  >
                    목록
                  </button>
                  <button
                    type="button"
                    className="workspace-memo-save-button"
                    onClick={handleSaveProjectMemo}
                    disabled={isProjectMemoSaving}
                  >
                    저장
                  </button>
                </div>
              ) : (
                <div className="workspace-memo-toolbar-actions">
                  <button
                    type="button"
                    className="workspace-memo-icon-button"
                    onClick={handleProjectMemoDeleteModeOpen}
                    disabled={!projectMemos.length || isProjectMemoDeleting}
                    aria-label="메모 삭제 선택"
                    title="메모 삭제 선택"
                  >
                    -
                  </button>
                  {isProjectMemoDeleteMode ? (
                    <button
                      type="button"
                      className="workspace-memo-confirm-button"
                      onClick={handleConfirmProjectMemoDelete}
                      disabled={isProjectMemoDeleting}
                    >
                      확인
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="workspace-memo-icon-button"
                      onClick={handleCreateProjectMemo}
                      disabled={!activeProjectData?.projectId}
                      aria-label="새 메모"
                      title="새 메모"
                    >
                      +
                    </button>
                  )}
                </div>
              )}
            </div>

            {isProjectMemoLoading ? <p className="workspace-empty-copy">메모를 불러오는 중입니다.</p> : null}

            {!isProjectMemoLoading && projectMemoViewMode === "list" && projectMemos.length ? (
              <div
                className={`workspace-memo-list ${isProjectMemoDeleteMode ? "workspace-memo-list-delete-mode" : ""}`}
                aria-label="프로젝트 메모 목록"
              >
                {projectMemos.map((memo) => (
                  <div key={memo.memoId} className="workspace-memo-list-row">
                    <input
                      type="checkbox"
                      className="workspace-memo-delete-checkbox"
                      checked={selectedProjectMemoDeleteIds.includes(memo.memoId)}
                      onChange={() => handleProjectMemoDeleteToggle(memo.memoId)}
                      aria-label={`${memo.title || "Untitled"} 삭제 선택`}
                      tabIndex={isProjectMemoDeleteMode ? 0 : -1}
                    />
                    <span className="workspace-memo-delete-checkmark" aria-hidden="true" />
                    <button
                      type="button"
                      className={`workspace-memo-list-item ${
                        memo.memoId === selectedProjectMemoId ? "workspace-memo-list-item-active" : ""
                      }`}
                      onClick={() => handleProjectMemoSelect(memo.memoId)}
                    >
                      <span>{memo.title || "Untitled"}</span>
                    </button>
                  </div>
                ))}
              </div>
            ) : null}

            {!isProjectMemoLoading && projectMemoViewMode === "list" && !projectMemos.length ? (
              <p className="workspace-memo-empty">생성된 메모가 없습니다</p>
            ) : null}

            {projectMemoError && projectMemoViewMode === "list" ? (
              <p className="workspace-modal-error">{projectMemoError}</p>
            ) : null}

            {projectMemoViewMode === "editor" ? (
              <>
                {showProjectMemoTitleWarning ? (
                  <div className="workspace-memo-title-popover">{projectMemoTitleWarningMessage}</div>
                ) : null}
                <input
                  className={`workspace-memo-title-input ${
                    isProjectMemoTitleShaking ? "workspace-memo-title-input-shake" : ""
                  }`}
                  value={projectMemoTitle}
                  onChange={(event) => handleProjectMemoTitleChange(event.target.value)}
                  placeholder="메모 제목"
                />
                <textarea
                  value={projectMemoContent}
                  onChange={(event) => handleProjectMemoContentChange(event.target.value)}
                  placeholder="학습 중 떠오른 생각을 자유롭게 적어보세요."
                />
                <div className="workspace-memo-footer">
                  {projectMemoError ? (
                    <p className="workspace-modal-error">{projectMemoError}</p>
                  ) : isProjectMemoSaving ? (
                    <p className="workspace-empty-copy">메모를 저장하는 중입니다.</p>
                  ) : showProjectMemoTitleWarning ? (
                    <p className="workspace-empty-copy">제목 입력 후 저장할 수 있습니다.</p>
                  ) : isProjectMemoDirty ? (
                    <p className="workspace-empty-copy">저장되지 않은 변경사항이 있습니다.</p>
                  ) : selectedProjectMemo ? (
                    <p className="workspace-empty-copy">저장됨</p>
                  ) : (
                    <span aria-hidden="true" />
                  )}
                </div>
              </>
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

      {isReportGraphOpen ? (
        <ReportGraphOverlay
          graph={projectGraph}
          projectTitle={activeProjectData?.title || null}
          selectedNodeId={selectedReportGraphNodeId}
          onSelectNode={setSelectedReportGraphNodeId}
          onClose={() => {
            setIsReportGraphOpen(false);
            setSelectedReportGraphNodeId(null);
          }}
        />
      ) : null}

      {activeQuizReview ? (
        <QuizReviewPopup
          entry={activeQuizReview.entry}
          onClose={() => setActiveQuizReview(null)}
        />
      ) : null}

      {activeMiniQuiz ? (
        <MiniQuizPopup
          projectId={activeMiniQuiz.projectId}
          chatSessionId={getChatSessionIdFromDashboardChatId(activeMiniQuiz.projectId, selectedChatId)}
          conceptNodeId={activeMiniQuiz.nodeId}
          conceptName={activeMiniQuiz.name}
          conceptQueue={activeMiniQuiz.queue}
          onResult={({ nodeId, conceptName, reviewEntry }) => {
            setMiniQuizResults((current) => {
              const dedup = current.filter(
                (item) => item.review.question_id !== reviewEntry.question_id
              );
              return [...dedup, { nodeId, conceptName, review: reviewEntry, completedAt: Date.now() }];
            });
          }}
          onComplete={(completeInfo = {}) => {
            const resultTargetChatId = selectedChatId;
            const completedNodeIds = Array.isArray(completeInfo.completedNodeIds) ? completeInfo.completedNodeIds : [];
            const updatedNodes = Array.isArray(completeInfo.results)
              ? completeInfo.results
                  .map((entry) => entry.backendResult?.updated_node || entry.backendResult?.group_result?.updated_node)
                  .filter((node) => node?.node_id)
              : [];
            setRecentChats((currentChats) =>
              appendMiniQuizResultMessagesToChat(currentChats, resultTargetChatId, completeInfo.results)
            );
            if (selectedProjectId && completedNodeIds.length) {
              if (updatedNodes.length) {
                const updatedNodeById = new Map(updatedNodes.map((node) => [node.node_id, node]));
                setBackendGraph((current) => {
                  if (!current?.nodes?.length) {
                    return current;
                  }
                  return {
                    ...current,
                    nodes: current.nodes.map((node) => {
                      const updatedNode = updatedNodeById.get(node.node_id);
                      if (!updatedNode) {
                        return node;
                      }
                      return {
                        ...node,
                        status: updatedNode.status ?? node.status,
                        understanding_score: updatedNode.understanding_score ?? node.understanding_score,
                        diagnosis_count: updatedNode.diagnosis_count ?? (Number(node.diagnosis_count || 0) + 1),
                      };
                    }),
                  };
                });
                setRecentGraphNodes((current) =>
                  Array.isArray(current)
                    ? current.map((node) => {
                        const updatedNode = updatedNodeById.get(node.node_id);
                        if (!updatedNode) {
                          return node;
                        }
                        return {
                          ...node,
                          status: updatedNode.status ?? node.status,
                          understanding_score: updatedNode.understanding_score ?? node.understanding_score,
                          diagnosis_count: updatedNode.diagnosis_count ?? (Number(node.diagnosis_count || 0) + 1),
                        };
                      })
                    : current
                );
              }
              getProjectGraphData(selectedProjectId)
                .then((nextGraph) => setBackendGraph(nextGraph))
                .catch(() => null);
              getRecentGraphNodes(selectedProjectId)
                .then((nextNodes) => setRecentGraphNodes(nextNodes))
                .catch(() => null);
              getProjectChats(selectedProjectId)
                .then((nextChats) =>
                  setRecentChats(appendMiniQuizResultMessagesToChat(nextChats, resultTargetChatId, completeInfo.results))
                )
                .catch(() => null);
            }
          }}
          onClose={(closeInfo = {}) => {
            const resultTargetChatId = selectedChatId;
            const sourceId = activeMiniQuiz.sourceMessageId;
            const deferredId = activeMiniQuiz.deferredId;
            const completedNodeIds = new Set(
              Array.isArray(closeInfo.completedNodeIds) ? closeInfo.completedNodeIds : []
            );
            const completedDeferredKeys = getCompletedMiniQuizDeferredKeys(activeMiniQuiz, closeInfo.results);
            setActiveMiniQuiz(null);

            if (sourceId) {
              const sourceTargets = Array.isArray(activeMiniQuiz.queue)
                ? activeMiniQuiz.queue
                : activeMiniQuiz.nodeId
                  ? [{ nodeId: activeMiniQuiz.nodeId }]
                  : [];
              const isSourceQuizCompleted =
                sourceTargets.length > 0 && sourceTargets.every((target) => completedNodeIds.has(target.nodeId));

              if (isSourceQuizCompleted) {
                updateMiniQuizCompletedByMessage((current) => ({ ...current, [sourceId]: true }));
                updateMiniQuizReadyByMessage((current) => ({ ...current, [sourceId]: [] }));
              } else {
                // trigger 버튼은 풀이가 완료된 노드만 제거 — 닫기로 끝낸 미풀이 노드는 그대로 둔다.
                updateMiniQuizReadyByMessage((current) => {
                  const previous = current[sourceId];
                  if (!Array.isArray(previous) || !previous.length) {
                    return current;
                  }
                  const remaining = previous.filter((target) => !completedNodeIds.has(target.nodeId));
                  if (remaining.length === previous.length) {
                    return current;
                  }
                  return { ...current, [sourceId]: remaining };
                });
              }
            }

            if (completedNodeIds.size) {
              updateDeferredMiniQuizzes((current) =>
                current.filter((item) => {
                  const itemKey = getDeferredMiniQuizDedupeKey(item);
                  if (itemKey && completedDeferredKeys.has(itemKey)) {
                    return false;
                  }

                  return isDeferredMiniQuizGroupItem(item) || !completedNodeIds.has(item.nodeId);
                })
              );
            } else if (deferredId) {
              // 안전장치 — 명시적 deferredId가 있고 완료된 노드가 없으면 그대로 둔다 (미풀이 닫기).
              // 별도 처리 없음.
            }

            if (selectedProjectId) {
              if (completedNodeIds.size) {
                getProjectGraphData(selectedProjectId)
                  .then((nextGraph) => setBackendGraph(nextGraph))
                  .catch(() => null);
                getRecentGraphNodes(selectedProjectId)
                  .then((nextNodes) => setRecentGraphNodes(nextNodes))
                  .catch(() => null);
                getProjectChats(selectedProjectId)
                  .then((nextChats) =>
                    setRecentChats(appendMiniQuizResultMessagesToChat(nextChats, resultTargetChatId, closeInfo.results))
                  )
                  .catch(() => null);
              }
            }
          }}
        />
      ) : null}

      {openingMiniQuizMessageId ? <MiniQuizOpeningOverlay /> : null}

    </div>
  );
}
