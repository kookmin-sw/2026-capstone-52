"use client";

import { useEffect, useMemo, useState } from "react";
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

const stars = Array.from({ length: 54 }, (_, index) => ({
  id: `star-${index}`,
  x: (index * 83 + 17) % 1000,
  y: (index * 137 + 31) % 760,
  r: index % 7 === 0 ? 2.1 : index % 3 === 0 ? 1.4 : 0.9,
  opacity: 0.14 + (index % 5) * 0.045,
}));

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

function getGraphBounds(nodes: ProjectKnowledgeGraphNode[]) {
  if (!nodes.length) {
    return { minX: 0, minY: 0, width: 1000, height: 760 };
  }

  const rawBounds = nodes.reduce(
    (bounds, node) => {
      const x = node.x * 1000;
      const y = node.y * 760;
      const radius = (node.isCore ? 104 : 48) * Math.max(node.size, 0.7);

      return {
        minX: Math.min(bounds.minX, x - radius),
        maxX: Math.max(bounds.maxX, x + radius),
        minY: Math.min(bounds.minY, y - radius),
        maxY: Math.max(bounds.maxY, y + radius),
      };
    },
    {
      minX: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY,
    }
  );

  const padding = 112;
  let minX = rawBounds.minX - padding;
  let minY = rawBounds.minY - padding;
  let width = rawBounds.maxX - rawBounds.minX + padding * 2;
  let height = rawBounds.maxY - rawBounds.minY + padding * 2;

  const minWidth = 760;
  const minHeight = 560;

  if (width < minWidth) {
    minX -= (minWidth - width) / 2;
    width = minWidth;
  }

  if (height < minHeight) {
    minY -= (minHeight - height) / 2;
    height = minHeight;
  }

  return { minX, minY, width, height };
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

  const viewBox = useMemo(() => getGraphBounds(graph.nodes), [graph.nodes]);
  const nodeById = useMemo(() => new Map(graph.nodes.map((node) => [node.id, node])), [graph.nodes]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-[radial-gradient(circle_at_78%_88%,rgba(255,138,98,0.16),transparent_24%),radial-gradient(circle_at_24%_86%,rgba(114,169,246,0.13),transparent_25%),linear-gradient(180deg,#ffffff_0%,#faf9ff_100%)] text-[#24213d]">
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
          <svg
            className="h-full w-full"
            viewBox={`${viewBox.minX} ${viewBox.minY} ${viewBox.width} ${viewBox.height}`}
            preserveAspectRatio="xMidYMid meet"
            role="img"
            aria-label="전체 지식 그래프"
          >
            <defs>
              <filter id="full-graph-soft-shadow" x="-40%" y="-40%" width="180%" height="180%">
                <feDropShadow dx="0" dy="22" stdDeviation="22" floodColor="#2a2649" floodOpacity="0.12" />
              </filter>
            </defs>

            {stars.map((star) => (
              <circle
                key={star.id}
                cx={star.x}
                cy={star.y}
                r={star.r}
                fill="#817cf2"
                opacity={star.opacity}
              />
            ))}

            {graph.edges.map((edge) => {
              const source = nodeById.get(edge.source);
              const target = nodeById.get(edge.target);

              if (!source || !target) {
                return null;
              }

              const isDimmed =
                visibleProjectIds &&
                (!visibleProjectIds.has(getProjectId(source.id)) || !visibleProjectIds.has(getProjectId(target.id)));

              return (
                <line
                  key={`${edge.source}-${edge.target}`}
                  x1={source.x * 1000}
                  y1={source.y * 760}
                  x2={target.x * 1000}
                  y2={target.y * 760}
                  stroke="#d8d3ff"
                  strokeWidth={isDimmed ? 0.7 : 1.4}
                  strokeDasharray={source.isCore && target.isCore ? "6 8" : undefined}
                  opacity={isDimmed ? 0.13 : 0.62}
                />
              );
            })}

            {graph.nodes
              .filter((node) => node.isCore)
              .map((node) => {
                const isDimmed = visibleProjectIds && !visibleProjectIds.has(getProjectId(node.id));
                const x = node.x * 1000;
                const y = node.y * 760;
                const radius = 88 * Math.max(node.size, 0.75);

                return (
                  <g key={`halo-${node.id}`} opacity={isDimmed ? 0.13 : 1}>
                    <circle cx={x} cy={y} r={radius * 1.45} fill={node.color} opacity="0.08" />
                    <circle cx={x} cy={y} r={radius} fill={node.color} opacity="0.08" />
                  </g>
                );
              })}

            {graph.nodes.map((node) => {
              const isDimmed = visibleProjectIds && !visibleProjectIds.has(getProjectId(node.id));
              const x = node.x * 1000;
              const y = node.y * 760;
              const radius = node.isCore ? 42 * Math.max(node.size, 0.9) : 20 * Math.max(node.size, 0.9);

              return (
                <g key={node.id} opacity={isDimmed ? 0.18 : 1} filter={node.isCore ? "url(#full-graph-soft-shadow)" : undefined}>
                  <circle
                    cx={x}
                    cy={y}
                    r={radius}
                    fill={node.isCore ? node.color : "white"}
                    stroke={node.color}
                    strokeWidth={node.isCore ? 0 : 3}
                  />
                  <text
                    x={x}
                    y={y + (node.isCore ? 6 : 4)}
                    textAnchor="middle"
                    fontSize={node.isCore ? 18 : 12}
                    fontWeight="900"
                    fill={node.isCore ? "white" : node.color}
                  >
                    {node.label.length > 8 ? node.label.slice(0, 8) : node.label}
                  </text>
                </g>
              );
            })}
          </svg>
        ) : (
          <div className="grid h-full place-items-center text-[1rem] font-black text-[#aaa6c0]">
            아직 생성된 지식 그래프가 없습니다.
          </div>
        )}
      </main>
    </div>
  );
}
