"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import KnowledgeGraphScene from "@/components/graph/knowledge-graph-scene";
import {
  buildBackendKnowledgeGraph,
  buildIntegratedKnowledgeGraph,
  buildProjectKnowledgeGraph,
  type ProjectKnowledgeGraphData,
} from "@/features/dashboard/graph";
import { getProjectChats, getProjectGraphData, getProjects } from "@/features/dashboard/service";

const emptyGraph: ProjectKnowledgeGraphData = {
  nodes: [],
  edges: [],
  defaultSelectedNodeId: null,
};

type GraphFilterItem = {
  id: string;
  label: string;
  color: string;
};

export default function GalaxyGraphPanel() {
  const [graph, setGraph] = useState<ProjectKnowledgeGraphData>(emptyGraph);
  const [filters, setFilters] = useState<GraphFilterItem[]>([]);
  const [selectedFilterId, setSelectedFilterId] = useState("all");
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [resetViewKey, setResetViewKey] = useState(0);

  useEffect(() => {
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
            const graph = backendGraph
              ? buildBackendKnowledgeGraph(projectInput, backendGraph, chats)
              : buildProjectKnowledgeGraph(projectInput, chats);

            return {
              project: {
                projectId: project.id,
                title: project.title,
              },
              graph,
            };
          })
        );

        if (!cancelled) {
          setGraph(buildIntegratedKnowledgeGraph(projectGraphs));
          setFilters(
            projectGraphs
              .filter(({ graph }) => graph.nodes.length)
              .map(({ project, graph }) => {
                const coreNode = graph.nodes.find((node) => node.isCore) || graph.nodes[0];

                return {
                  id: project.projectId,
                  label: coreNode?.subtitle || project.title,
                  color: coreNode?.color || "#8b5cf6",
                };
              })
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadGraph();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const graphMeta = useMemo(
    () => ({
      nodeCount: graph.nodes.length,
      edgeCount: graph.edges.length,
    }),
    [graph.edges.length, graph.nodes.length]
  );
  const dimmedNodeIds = useMemo(
    () =>
      selectedFilterId === "all"
        ? []
        : graph.nodes
            .filter((node) => !node.id.startsWith(`${selectedFilterId}::`))
            .map((node) => node.id),
    [graph.nodes, selectedFilterId]
  );

  return (
    <>
      <motion.button
        type="button"
        layoutId="mypage-integrated-graph-panel"
        onClick={() => {
          setIsOpen(true);
          setResetViewKey((current) => current + 1);
        }}
        className="relative min-h-0 overflow-hidden rounded-[19px] bg-[#080910] text-left"
        aria-label="통합 지식 그래프 전체 화면 열기"
      >
        {isLoading ? (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(124,92,255,0.14),transparent_34%),#080910]" />
        ) : graph.nodes.length ? (
          <KnowledgeGraphScene
            nodes={graph.nodes}
            edges={graph.edges}
            compact
            animated
            className="absolute inset-0"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm font-medium text-white/36">
            아직 생성된 지식 그래프가 없습니다.
          </div>
        )}

        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/34">Knowledge Graph</p>
            <h3 className="mt-1 text-lg font-bold text-white">통합 지식 그래프</h3>
          </div>
          <span className="rounded-full bg-white/8 px-3 py-1 text-xs font-semibold text-white/52">
            {graphMeta.nodeCount} nodes
          </span>
        </div>
      </motion.button>

      <AnimatePresence>
        {isOpen ? (
          <motion.div
            className="fixed inset-0 z-50 bg-[#080910]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            <motion.div
              layoutId="mypage-integrated-graph-panel"
              className="absolute inset-0 overflow-hidden bg-[#080910]"
              transition={{ type: "spring", stiffness: 190, damping: 28 }}
            >
              {graph.nodes.length ? (
                <KnowledgeGraphScene
                  nodes={graph.nodes}
                  edges={graph.edges}
                  interactive
                  showLabels
                  resetViewKey={resetViewKey}
                  dimmedNodeIds={dimmedNodeIds}
                  className="absolute inset-0"
                />
              ) : null}

              <aside className="absolute bottom-0 left-0 top-0 z-10 w-[252px] bg-[#292a2e] px-4 py-6 shadow-[18px_0_60px_rgba(0,0,0,0.16)]">
                <div>
                  <h2 className="text-[15px] font-bold text-white">지식 그래프</h2>
                  <p className="mt-2 text-[12px] text-[#8d8d92]">내 학습의 우주를 탐험하세요</p>
                </div>

                <div className="mt-5 h-px bg-white/10" />

                <div className="mt-5">
                  <p className="text-[12px] font-semibold text-[#9b9ba0]">과목 필터</p>
                  <div className="mt-3 flex flex-col items-start gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedFilterId("all")}
                      className={`flex items-center gap-2 rounded-full px-3 py-2 text-[13px] transition ${
                        selectedFilterId === "all"
                          ? "bg-[#4a3679] text-[#b99aff] ring-2 ring-[#825cff]"
                          : "bg-[#343642] text-[#9d9da4] hover:bg-[#3d3f4b] hover:text-white"
                      }`}
                    >
                      <span className="h-[10px] w-[10px] rounded-full bg-[#835cff]" />
                      전체
                    </button>

                    {filters.map((filter) => (
                      <button
                        key={filter.id}
                        type="button"
                        onClick={() => setSelectedFilterId(filter.id)}
                        className={`flex items-center gap-2 rounded-full px-3 py-2 text-[13px] transition ${
                          selectedFilterId === filter.id
                            ? "bg-[#4a3679] text-[#d7c9ff] ring-2 ring-[#825cff]"
                            : "bg-[#343642] text-[#a8a8ae] hover:bg-[#3d3f4b] hover:text-white"
                        }`}
                      >
                        <span
                          className="h-[10px] w-[10px] rounded-full"
                          style={{ backgroundColor: filter.color }}
                        />
                        {filter.label}
                      </button>
                    ))}
                  </div>
                </div>
              </aside>

              <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-end px-8 py-7">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-2xl leading-none text-white transition hover:bg-white/16"
                  aria-label="통합 지식 그래프 닫기"
                >
                  ×
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
