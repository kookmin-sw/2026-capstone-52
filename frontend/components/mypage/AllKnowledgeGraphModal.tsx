"use client";

import { useEffect, useMemo, useState } from "react";
import KnowledgeGraphScene from "@/components/graph/knowledge-graph-scene";
import {
  buildBackendKnowledgeGraph,
  buildIntegratedKnowledgeGraph,
  buildProjectKnowledgeGraph,
  type ProjectKnowledgeGraphData,
  type ProjectKnowledgeGraphNode,
} from "@/features/dashboard/graph";
import { getProjectChats, getProjectGraphData, getProjects } from "@/features/dashboard/service";
import EeumIcon from "@/components/common/EeumIcon";

type GraphFilter = {
  id: string;
  label: string;
  color: string;
};

type AllKnowledgeGraphModalProps = {
  open: boolean;
  onClose: () => void;
};

const emptyGraph: ProjectKnowledgeGraphData = {
  nodes: [],
  edges: [],
  defaultSelectedNodeId: null,
};

const categoryOrder = ["all", "os", "ds", "algo", "network"];
const fallbackFilters: GraphFilter[] = [
  { id: "all", label: "전체", color: "#817cf2" },
  { id: "os", label: "운영체제", color: "#817cf2" },
  { id: "ds", label: "자료구조", color: "#ff8a62" },
  { id: "algo", label: "알고리즘", color: "#60d3a7" },
  { id: "network", label: "컴퓨터 네트워크", color: "#72a9f6" },
];

function getProjectId(nodeId: string) {
  return nodeId.includes("::") ? nodeId.split("::")[0] : nodeId;
}

function getFilterLabel(coreNode: ProjectKnowledgeGraphNode | undefined, fallback: string) {
  if (!coreNode) {
    return fallback;
  }

  const subtitleParts = coreNode.subtitle.split("·").map((part) => part.trim()).filter(Boolean);
  return subtitleParts[subtitleParts.length - 1] || coreNode.label || fallback;
}

function EeumMark() {
  return <EeumIcon className="h-8 w-8" />;
}

export default function AllKnowledgeGraphModal({ open, onClose }: AllKnowledgeGraphModalProps) {
  const [graph, setGraph] = useState<ProjectKnowledgeGraphData>(emptyGraph);
  const [filters, setFilters] = useState<GraphFilter[]>(fallbackFilters);
  const [activeFilter, setActiveFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    let cancelled = false;

    async function loadGraph() {
      setIsLoading(true);

      try {
        const projects = await getProjects();
        const projectGraphs = await Promise.all(
          projects.map(async (project) => {
            const [chats, backendGraph] = await Promise.all([
              getProjectChats(project.id),
              getProjectGraphData(project.id).catch(() => null),
            ]);
            const projectInput = {
              projectId: project.id,
              title: project.title,
            };
            const nextGraph = backendGraph
              ? buildBackendKnowledgeGraph(projectInput, backendGraph, chats)
              : buildProjectKnowledgeGraph(projectInput, chats);

            return {
              project: projectInput,
              graph: nextGraph,
            };
          })
        );

        if (cancelled) {
          return;
        }

        const nextFilters = projectGraphs
          .filter(({ graph: projectGraph }) => projectGraph.nodes.length)
          .map(({ project, graph: projectGraph }) => {
            const coreNode = projectGraph.nodes.find((node) => node.isCore) || projectGraph.nodes[0];

            return {
              id: project.projectId,
              label: getFilterLabel(coreNode, project.title),
              color: coreNode?.color || "#817cf2",
            };
          });

        setGraph(buildIntegratedKnowledgeGraph(projectGraphs));
        setFilters([
          fallbackFilters[0],
          ...nextFilters.sort(
            (left, right) => categoryOrder.indexOf(left.id) - categoryOrder.indexOf(right.id)
          ),
        ]);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadGraph();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      cancelled = true;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  const visibleProjectIds = useMemo(() => {
    if (activeFilter === "all") {
      return null;
    }

    return new Set([activeFilter]);
  }, [activeFilter]);

  const dimmedNodeIds = useMemo(
    () =>
      visibleProjectIds
        ? graph.nodes
            .filter((node) => !visibleProjectIds.has(getProjectId(node.id)))
            .map((node) => node.id)
        : [],
    [graph.nodes, visibleProjectIds]
  );

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-[#fbfaff] text-[#24213d]">
      <header className="absolute left-10 top-8 z-20 flex items-center gap-5">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-10 items-center gap-2 rounded-full border border-[#ebe9f5] bg-white px-5 text-[0.92rem] font-black text-[#24213d] shadow-[0_14px_34px_rgba(42,38,73,0.08)] transition hover:border-[#d8d3ff] hover:text-[#817cf2]"
        >
          ← 돌아가기
        </button>
        <div className="flex items-center gap-3">
          <EeumMark />
          <strong className="text-[1.35rem] font-black text-[#24213d]">이음</strong>
        </div>
      </header>

      <section className="absolute inset-x-0 top-[7.2rem] z-10 grid justify-items-center px-6 text-center">
        <span className="rounded-full bg-[#ebe8ff] px-4 py-2 text-[0.8rem] font-black text-[#817cf2]">
          지식 그래프
        </span>
        <h2 className="mt-5 text-[clamp(2.1rem,3vw,3.4rem)] font-black leading-tight tracking-[-0.01em] text-[#24213d]">
          내 학습의 <span className="text-[#c48baa]">우주</span>를 탐험하세요
        </h2>
        <p className="mt-3 text-[1.05rem] font-semibold text-[#74708b]">
          지금까지 학습한 모든 개념이 하나의 그래프로 연결돼요.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          {filters.map((filter) => {
            const isActive = activeFilter === filter.id;

            return (
              <button
                key={filter.id}
                type="button"
                onClick={() => setActiveFilter(filter.id)}
                className={`inline-flex h-11 min-w-[5.4rem] items-center justify-center rounded-full border px-5 text-[0.92rem] font-black shadow-[0_12px_26px_rgba(42,38,73,0.06)] transition ${
                  isActive
                    ? "border-[#817cf2] bg-[#817cf2] text-white"
                    : "border-[#ebe9f5] bg-white text-[#24213d] hover:border-[#d8d3ff] hover:text-[#817cf2]"
                }`}
              >
                {filter.label}
              </button>
            );
          })}
        </div>
      </section>

      <main className="absolute inset-x-0 bottom-0 top-[18.5rem]">
        {isLoading ? (
          <div className="grid h-full place-items-center text-[1rem] font-black text-[#817cf2]">
            지식 그래프를 불러오는 중입니다.
          </div>
        ) : graph.nodes.length ? (
          <KnowledgeGraphScene
            nodes={graph.nodes}
            edges={graph.edges}
            interactive
            showLabels
            labelVariant="light"
            nodeSizeScale={0.7}
            dimmedNodeIds={dimmedNodeIds}
            autoFitDuration={0}
          />
        ) : (
          <div className="grid h-full place-items-center text-[1rem] font-black text-[#aaa6c0]">
            아직 생성된 지식 그래프가 없습니다.
          </div>
        )}
      </main>
    </div>
  );
}
