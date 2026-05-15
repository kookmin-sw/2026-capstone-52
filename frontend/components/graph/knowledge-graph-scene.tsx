"use client";

import dynamic from "next/dynamic";
import type { ForceGraphMethods, LinkObject, NodeObject } from "react-force-graph-2d";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false }) as any;

export type KnowledgeGraphNode = {
  id: string;
  label: string;
  x: number;
  y: number;
  size: number;
  color: string;
  isCore?: boolean;
};

export type KnowledgeGraphEdge = {
  source: string;
  target: string;
};

type KnowledgeGraphSceneProps = {
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
  className?: string;
  compact?: boolean;
  animated?: boolean;
  interactive?: boolean;
  showLabels?: boolean;
  selectedNodeId?: string | null;
  onNodeSelect?: (nodeId: string | null) => void;
  onBackgroundClick?: () => void;
  focusNodeId?: string | null;
  resetViewKey?: string | number;
  dimmedNodeIds?: string[];
  labelVariant?: "dark" | "light";
  nodeSizeScale?: number;
};

type ForceNode = KnowledgeGraphNode & {
  val: number;
  searchText: string;
  __seedX: number;
  __seedY: number;
};

type ForceLink = KnowledgeGraphEdge & {
  id: string;
};

const MIN_HEIGHT = 220;
const GRAPH_PADDING = 76;
const LIGHT_BACKGROUND = "#fbfaff";
const DARK_BACKGROUND = "#080910";
const TRANSPARENT_BACKGROUND = "rgba(0,0,0,0)";
const MAX_AUTO_ZOOM = 1.18;
const MAX_FOCUS_ZOOM = 1.42;

function getEndpointId(endpoint: string | number | NodeObject<ForceNode> | undefined) {
  if (endpoint && typeof endpoint === "object") {
    return String(endpoint.id);
  }

  return endpoint == null ? "" : String(endpoint);
}

function getNodeRadius(node: ForceNode, compact: boolean, nodeSizeScale = 1) {
  const base = compact ? 1.6 : 2.1;
  const multiplier = compact ? 1.7 : 2.2;

  return Math.max(base, node.val * multiplier) * nodeSizeScale;
}

function truncateLabel(label: string, maxLength: number) {
  if (label.length <= maxLength) {
    return label;
  }

  return `${label.slice(0, maxLength - 1)}…`;
}

export default function KnowledgeGraphScene({
  nodes,
  edges,
  className = "",
  compact = false,
  animated = false,
  interactive = false,
  showLabels = false,
  selectedNodeId,
  onNodeSelect,
  onBackgroundClick,
  focusNodeId = null,
  resetViewKey,
  dimmedNodeIds = [],
  labelVariant = "dark",
  nodeSizeScale = 1,
}: KnowledgeGraphSceneProps) {
  const graphRef = useRef<ForceGraphMethods<ForceNode, ForceLink> | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [internalSelectedNodeId, setInternalSelectedNodeId] = useState<string | null>(null);

  const isControlledSelection = selectedNodeId !== undefined;
  const activeSelectedNodeId = isControlledSelection ? selectedNodeId : internalSelectedNodeId;
  const isLight = labelVariant === "light";
  const dimmedNodeIdSet = useMemo(() => new Set(dimmedNodeIds), [dimmedNodeIds]);
  const gridLineColor = isLight ? "rgba(36,33,61,0.045)" : "rgba(255,255,255,0.045)";
  const gridBackgroundColor = isLight ? LIGHT_BACKGROUND : DARK_BACKGROUND;

  const graphData = useMemo(() => {
    const spread = compact ? 260 : 430;

    return {
      nodes: nodes.map((node) => {
        const seedX = (node.x - 0.5) * spread;
        const seedY = (node.y - 0.5) * spread;

        return {
          ...node,
          x: seedX,
          y: seedY,
          __seedX: seedX,
          __seedY: seedY,
          val: Math.max(1.2, Math.min(7.5, (node.isCore ? 1.25 : 1) * node.size)),
          searchText: node.label.toLowerCase(),
        };
      }),
      links: edges.map((edge, index) => ({
        ...edge,
        id: `${edge.source}-${edge.target}-${index}`,
      })),
    };
  }, [compact, edges, nodes]);

  const connectedNodeIds = useMemo(() => {
    if (!activeSelectedNodeId) {
      return new Set<string>();
    }

    const connected = new Set<string>([activeSelectedNodeId]);

    graphData.links.forEach((link) => {
      const source = getEndpointId(link.source);
      const target = getEndpointId(link.target);

      if (source === activeSelectedNodeId) {
        connected.add(target);
      }

      if (target === activeSelectedNodeId) {
        connected.add(source);
      }
    });

    return connected;
  }, [activeSelectedNodeId, graphData.links]);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      setDimensions((current) => {
        const next = {
          width: Math.max(1, Math.floor(rect.width)),
          height: Math.max(MIN_HEIGHT, Math.floor(rect.height)),
        };

        return current.width === next.width && current.height === next.height ? current : next;
      });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(container);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const graph = graphRef.current;

    if (!graph || !graphData.nodes.length) {
      return;
    }

    graph.d3Force("charge")?.strength?.(compact ? -42 : -86);
    graph.d3Force("link")?.distance?.((link: LinkObject<ForceNode, ForceLink>) => {
      const source = link.source as ForceNode | undefined;
      const target = link.target as ForceNode | undefined;

      if (source?.isCore || target?.isCore) {
        return compact ? 38 : 78;
      }

      return compact ? 28 : 58;
    });
    graph.d3ReheatSimulation();
  }, [compact, graphData]);

  const fitGraphToView = useCallback((duration = 420) => {
    const graph = graphRef.current;

    if (!graph) {
      return;
    }

    graph.zoomToFit(duration, GRAPH_PADDING);

    window.setTimeout(() => {
      const currentZoom = graph.zoom();

      if (currentZoom > MAX_AUTO_ZOOM) {
        graph.zoom(MAX_AUTO_ZOOM, 180);
      }
    }, duration + 30);
  }, []);

  useEffect(() => {
    if (!graphRef.current || !dimensions.width || !dimensions.height || !graphData.nodes.length) {
      return;
    }

    const timer = window.setTimeout(() => {
      fitGraphToView();
    }, 220);

    return () => window.clearTimeout(timer);
  }, [dimensions.height, dimensions.width, fitGraphToView, graphData, resetViewKey]);

  useEffect(() => {
    if (!focusNodeId || !graphRef.current) {
      return;
    }

    const focusNode = graphData.nodes.find((node) => node.id === focusNodeId);

    if (!focusNode) {
      return;
    }

    const timer = window.setTimeout(() => {
      graphRef.current?.centerAt(focusNode.x ?? focusNode.__seedX, focusNode.y ?? focusNode.__seedY, 520);
      graphRef.current?.zoom(compact ? 1.18 : MAX_FOCUS_ZOOM, 520);
    }, 120);

    return () => window.clearTimeout(timer);
  }, [compact, focusNodeId, graphData.nodes]);

  useEffect(() => {
    if (animated) {
      graphRef.current?.resumeAnimation();
    } else if (!interactive) {
      const timer = window.setTimeout(() => graphRef.current?.pauseAnimation(), 900);
      return () => window.clearTimeout(timer);
    }
  }, [animated, interactive, graphData]);

  const setSelected = useCallback(
    (nodeId: string | null) => {
      if (!isControlledSelection) {
        setInternalSelectedNodeId(nodeId);
      }

      onNodeSelect?.(nodeId);
    },
    [isControlledSelection, onNodeSelect]
  );

  const drawLink = useCallback(
    (link: LinkObject<ForceNode, ForceLink>, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const source = link.source as ForceNode | undefined;
      const target = link.target as ForceNode | undefined;

      if (
        !Number.isFinite(source?.x) ||
        !Number.isFinite(source?.y) ||
        !Number.isFinite(target?.x) ||
        !Number.isFinite(target?.y)
      ) {
        return;
      }

      const sourceId = getEndpointId(source);
      const targetId = getEndpointId(target);
      const isSelectedLink =
        Boolean(activeSelectedNodeId) && (sourceId === activeSelectedNodeId || targetId === activeSelectedNodeId);
      const isDimmed =
        dimmedNodeIdSet.has(sourceId) ||
        dimmedNodeIdSet.has(targetId) ||
        (Boolean(activeSelectedNodeId) && !isSelectedLink);

      ctx.save();
      ctx.globalAlpha = isDimmed ? 0.12 : 1;
      ctx.strokeStyle = isSelectedLink
        ? isLight
          ? "rgba(129,124,242,0.68)"
          : "rgba(245,211,138,0.58)"
        : isLight
          ? "rgba(116,112,139,0.24)"
          : "rgba(160,196,255,0.18)";
      ctx.lineWidth = (isSelectedLink ? 1.55 : compact ? 0.58 : 0.86) / globalScale;
      ctx.beginPath();
      ctx.moveTo(source!.x!, source!.y!);
      ctx.lineTo(target!.x!, target!.y!);
      ctx.stroke();
      ctx.restore();
    },
    [activeSelectedNodeId, compact, dimmedNodeIdSet, isLight]
  );

  const drawNode = useCallback(
    (node: NodeObject<ForceNode>, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const forceNode = node as ForceNode;
      const isSelected = forceNode.id === activeSelectedNodeId;
      const isHovered = forceNode.id === hoveredNodeId;
      const isConnected = connectedNodeIds.has(forceNode.id);
      const hasSelection = Boolean(activeSelectedNodeId);
      const isDimmed = dimmedNodeIdSet.has(forceNode.id) || (hasSelection && !isConnected && !isHovered);
      const radius = getNodeRadius(forceNode, compact, nodeSizeScale);

      ctx.save();
      ctx.globalAlpha = isDimmed ? 0.18 : 1;

      if (forceNode.isCore || isSelected || isHovered) {
        ctx.beginPath();
        ctx.arc(forceNode.x!, forceNode.y!, radius + (forceNode.isCore ? 5.5 : 3.5), 0, Math.PI * 2);
        ctx.fillStyle = isSelected
          ? isLight
            ? "rgba(129,124,242,0.18)"
            : "rgba(245,211,138,0.16)"
          : `${forceNode.color}22`;
        ctx.fill();
      }

      if (isSelected || isHovered) {
        ctx.beginPath();
        ctx.arc(forceNode.x!, forceNode.y!, radius + (isSelected ? 4.5 : 3), 0, Math.PI * 2);
        ctx.strokeStyle = isSelected
          ? isLight
            ? "rgba(129,124,242,0.72)"
            : "rgba(245,211,138,0.68)"
          : "rgba(255,255,255,0.48)";
        ctx.lineWidth = (isSelected ? 1.45 : 1.05) / globalScale;
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.arc(forceNode.x!, forceNode.y!, radius, 0, Math.PI * 2);
      ctx.fillStyle = forceNode.color;
      ctx.shadowColor = forceNode.color;
      ctx.shadowBlur = isSelected ? 7 : forceNode.isCore ? 4 : compact ? 0.8 : 1.5;
      ctx.fill();
      ctx.shadowBlur = 0;

      if (forceNode.isCore) {
        ctx.strokeStyle = isLight ? "rgba(255,255,255,0.92)" : "rgba(251,250,255,0.78)";
        ctx.lineWidth = 1.15 / globalScale;
        ctx.stroke();
      }

      const shouldDrawLabel =
        showLabels &&
        forceNode.label &&
        (globalScale > 0.72 || isSelected || isHovered || forceNode.isCore);

      if (shouldDrawLabel) {
        const labelScale = Math.max(0.5, Math.min(0.92, 1 / globalScale));
        const fontSize = (isSelected ? 11.8 : forceNode.isCore ? 10.6 : 9.3) * labelScale;
        const label = truncateLabel(forceNode.label, forceNode.isCore ? 24 : 18);

        ctx.font = `${isSelected || forceNode.isCore ? 700 : 560} ${fontSize}px "Pretendard Variable", system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillStyle = isLight
          ? isSelected
            ? "#24213d"
            : "rgba(98,96,124,0.92)"
          : isSelected
            ? "#ffffff"
            : "rgba(255,255,255,0.78)";
        ctx.fillText(label, forceNode.x!, forceNode.y! + radius + 5 / globalScale);
      }

      ctx.restore();
    },
    [
      activeSelectedNodeId,
      compact,
      connectedNodeIds,
      dimmedNodeIdSet,
      hoveredNodeId,
      isLight,
      nodeSizeScale,
      showLabels,
    ]
  );

  const hoverNode = useMemo(
    () => (hoveredNodeId ? graphData.nodes.find((node) => node.id === hoveredNodeId) || null : null),
    [graphData.nodes, hoveredNodeId]
  );

  const hasSize = dimensions.width > 0 && dimensions.height > 0;

  return (
    <div
      ref={containerRef}
      aria-hidden={!interactive}
      className={`relative h-full w-full overflow-hidden ${interactive ? "" : "pointer-events-none"} ${className}`}
      style={{
        backgroundColor: gridBackgroundColor,
      }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `linear-gradient(${gridLineColor} 1px, transparent 1px), linear-gradient(90deg, ${gridLineColor} 1px, transparent 1px)`,
          backgroundSize: compact ? "32px 32px" : "30px 30px",
        }}
      />
      {hasSize ? (
        <ForceGraph2D
          ref={graphRef}
          graphData={graphData}
          width={dimensions.width}
          height={dimensions.height}
          backgroundColor={TRANSPARENT_BACKGROUND}
          nodeId="id"
          nodeVal="val"
          nodeLabel={(node: NodeObject<ForceNode>) => {
            const forceNode = node as ForceNode;
            return forceNode.label;
          }}
          nodeCanvasObject={drawNode}
          nodePointerAreaPaint={(
            node: NodeObject<ForceNode>,
            color: string,
            ctx: CanvasRenderingContext2D
          ) => {
            const forceNode = node as ForceNode;
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(forceNode.x!, forceNode.y!, Math.max(6, getNodeRadius(forceNode, compact, nodeSizeScale) + 4), 0, Math.PI * 2);
            ctx.fill();
          }}
          linkCanvasObjectMode={() => "replace"}
          linkCanvasObject={drawLink}
          cooldownTicks={animated ? Infinity : compact ? 90 : 150}
          d3AlphaDecay={animated ? 0.006 : 0.018}
          d3VelocityDecay={0.28}
          enableNodeDrag={interactive}
          enablePanInteraction={interactive}
          enableZoomInteraction={interactive}
          enablePointerInteraction={interactive}
          minZoom={0.28}
          maxZoom={4}
          showPointerCursor={(item: NodeObject<ForceNode> | LinkObject<ForceNode, ForceLink> | undefined) =>
            Boolean(interactive && item)
          }
          onNodeClick={(node: NodeObject<ForceNode>) => {
            if (!interactive) {
              return;
            }

            setSelected(String(node.id));
            graphRef.current?.centerAt(node.x, node.y, 520);
            graphRef.current?.zoom(compact ? 1.18 : MAX_FOCUS_ZOOM, 520);
          }}
          onNodeHover={(node: NodeObject<ForceNode> | null) => setHoveredNodeId(node ? String(node.id) : null)}
          onBackgroundClick={() => {
            if (interactive) {
              setSelected(null);
              onBackgroundClick?.();
            }
          }}
        />
      ) : null}

      {interactive && hoverNode ? (
        <div
          className={`pointer-events-none absolute bottom-4 left-4 max-w-[min(26rem,calc(100%-2rem))] rounded-md border px-3 py-2 shadow-[0_18px_44px_rgba(4,6,12,0.24)] ${
            isLight
              ? "border-[#ddd9f4] bg-white/94 text-[#24213d]"
              : "border-white/10 bg-[#1f2127]/94 text-white"
          }`}
        >
          <strong className="block truncate text-[0.82rem] font-bold">{hoverNode.label}</strong>
          {"subtitle" in hoverNode ? (
            <span className={`mt-1 block truncate text-[0.72rem] ${isLight ? "text-[#74708b]" : "text-white/50"}`}>
              {String(hoverNode.subtitle || "")}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
