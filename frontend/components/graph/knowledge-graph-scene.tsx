"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";

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
  focusNodeId?: string | null;
  resetViewKey?: string | number;
  dimmedNodeIds?: string[];
  labelVariant?: "dark" | "light";
};

type MotionNode = KnowledgeGraphNode & {
  driftX: number;
  driftY: number;
  phase: number;
  pulse: number;
};

type ViewportState = {
  scale: number;
  panX: number;
  panY: number;
};

type RenderedNode = MotionNode & {
  screenX: number;
  screenY: number;
  radius: number;
};

const EDGE_COLOR = "rgba(160, 196, 255, 0.18)";
const NODE_RING = "rgba(255, 255, 255, 0.16)";
const NODE_GLOW = "rgba(125, 211, 252, 0.12)";
const CORE_GLOW = "rgba(245, 211, 138, 0.16)";
const GRAPH_BACKGROUND = "rgba(42, 43, 46, 0)";
const MIN_SCALE = 0.78;
const MAX_SCALE = 2.4;
const VISIBILITY_MARGIN = 72;
const DRAG_THRESHOLD = 6;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getNodePosition(node: MotionNode, width: number, height: number, time: number, animated: boolean) {
  const graphDriftX = animated ? Math.sin(time * 0.00005) * width * 0.012 : 0;
  const graphDriftY = animated ? Math.cos(time * 0.00004) * height * 0.016 : 0;
  const orbitalX = animated ? Math.sin(time * 0.0002 + node.phase) * node.driftX : 0;
  const orbitalY = animated ? Math.cos(time * 0.00017 + node.phase * 1.2) * node.driftY : 0;
  const flutterX = animated ? Math.sin(time * 0.00032 + node.phase * 0.7) * 1.8 : 0;
  const flutterY = animated ? Math.cos(time * 0.00028 + node.phase * 0.9) * 1.6 : 0;
  const pulse = animated ? 1 + Math.sin(time * 0.0007 + node.phase) * node.pulse : 1;

  return {
    x: node.x * width + graphDriftX + orbitalX + flutterX,
    y: node.y * height + graphDriftY + orbitalY + flutterY,
    size: node.size * pulse,
  };
}

export default function KnowledgeGraphScene({
  nodes,
  edges,
  className = "",
  compact = false,
  animated = false,
  interactive = false,
  showLabels = false,
  selectedNodeId = null,
  onNodeSelect,
  focusNodeId = null,
  resetViewKey,
  dimmedNodeIds = [],
  labelVariant = "dark",
}: KnowledgeGraphSceneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const renderedNodesRef = useRef<RenderedNode[]>([]);
  const pointerStateRef = useRef({
    pointerId: null as number | null,
    startX: 0,
    startY: 0,
    startPanX: 0,
    startPanY: 0,
    moved: false,
  });

  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [viewport, setViewport] = useState<ViewportState>({ scale: 1, panX: 0, panY: 0 });
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  const shouldAnimate = animated && !interactive;
  const sizeScale = compact ? 0.46 : 1;
  const isLightLabelVariant = labelVariant === "light";
  const dimmedNodeIdSet = useMemo(() => new Set(dimmedNodeIds), [dimmedNodeIds]);

  const motionNodes = useMemo<MotionNode[]>(
    () =>
      nodes.map((node, index) => ({
        ...node,
        driftX: 8 + (index % 5) * 2.4,
        driftY: 7 + (index % 4) * 2,
        phase: index * 0.74,
        pulse: 0.04 + (index % 3) * 0.008,
      })),
    [nodes]
  );

  const baseNodes = useMemo(() => {
    if (!canvasSize.width || !canvasSize.height) {
      return [] as Array<{ id: string; x: number; y: number; radius: number }>;
    }

    return motionNodes.map((node) => {
      const position = getNodePosition(node, canvasSize.width, canvasSize.height, 0, false);

      return {
        id: node.id,
        x: position.x,
        y: position.y,
        radius: position.size * sizeScale,
      };
    });
  }, [canvasSize.height, canvasSize.width, motionNodes, sizeScale]);

  const clampViewport = useCallback(
    (candidate: ViewportState) => {
      if (!interactive || !baseNodes.length || !canvasSize.width || !canvasSize.height) {
        return candidate;
      }

      const centerX = canvasSize.width / 2;
      const centerY = canvasSize.height / 2;
      const bounds = baseNodes.reduce(
        (acc, node) => ({
          left: Math.min(acc.left, node.x - node.radius - 28),
          right: Math.max(acc.right, node.x + node.radius + 28),
          top: Math.min(acc.top, node.y - node.radius - 28),
          bottom: Math.max(acc.bottom, node.y + node.radius + 28),
        }),
        {
          left: Number.POSITIVE_INFINITY,
          right: Number.NEGATIVE_INFINITY,
          top: Number.POSITIVE_INFINITY,
          bottom: Number.NEGATIVE_INFINITY,
        }
      );

      const nextScale = clamp(candidate.scale, MIN_SCALE, MAX_SCALE);
      const leftNoPan = centerX + (bounds.left - centerX) * nextScale;
      const rightNoPan = centerX + (bounds.right - centerX) * nextScale;
      const topNoPan = centerY + (bounds.top - centerY) * nextScale;
      const bottomNoPan = centerY + (bounds.bottom - centerY) * nextScale;

      const minPanX = VISIBILITY_MARGIN - rightNoPan;
      const maxPanX = canvasSize.width - VISIBILITY_MARGIN - leftNoPan;
      const minPanY = VISIBILITY_MARGIN - bottomNoPan;
      const maxPanY = canvasSize.height - VISIBILITY_MARGIN - topNoPan;

      const nextPanX =
        minPanX > maxPanX ? (minPanX + maxPanX) / 2 : clamp(candidate.panX, minPanX, maxPanX);
      const nextPanY =
        minPanY > maxPanY ? (minPanY + maxPanY) / 2 : clamp(candidate.panY, minPanY, maxPanY);

      return {
        scale: nextScale,
        panX: nextPanX,
        panY: nextPanY,
      };
    },
    [baseNodes, canvasSize.height, canvasSize.width, interactive]
  );

  const renderedLabelNodes = useMemo(() => {
    if (!showLabels || !canvasSize.width || !canvasSize.height) {
      return [] as RenderedNode[];
    }

    const centerX = canvasSize.width / 2;
    const centerY = canvasSize.height / 2;

    return motionNodes.map((node) => {
      const position = getNodePosition(node, canvasSize.width, canvasSize.height, 0, false);
      const screenX = centerX + (position.x - centerX) * viewport.scale + viewport.panX;
      const screenY = centerY + (position.y - centerY) * viewport.scale + viewport.panY;

      return {
        ...node,
        screenX,
        screenY,
        radius: position.size * sizeScale * viewport.scale,
      };
    });
  }, [canvasSize.height, canvasSize.width, motionNodes, showLabels, sizeScale, viewport.panX, viewport.panY, viewport.scale]);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];

      if (!entry) {
        return;
      }

      const nextWidth = entry.contentRect.width;
      const nextHeight = entry.contentRect.height;

      setCanvasSize((current) =>
        current.width === nextWidth && current.height === nextHeight
          ? current
          : { width: nextWidth, height: nextHeight }
      );
    });

    observer.observe(container);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!interactive) {
      return;
    }

    setViewport({ scale: 1, panX: 0, panY: 0 });
  }, [interactive, resetViewKey]);

  useEffect(() => {
    if (!interactive || !focusNodeId || !baseNodes.length || !canvasSize.width || !canvasSize.height) {
      return;
    }

    const focusTarget = baseNodes.find((node) => node.id === focusNodeId);

    if (!focusTarget) {
      return;
    }

    const centerX = canvasSize.width / 2;
    const centerY = canvasSize.height / 2;

    setViewport((current) =>
      clampViewport({
        ...current,
        panX: -(focusTarget.x - centerX) * current.scale,
        panY: -(focusTarget.y - centerY) * current.scale,
      })
    );
  }, [baseNodes, canvasSize.height, canvasSize.width, clampViewport, focusNodeId, interactive]);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas || !canvasSize.width || !canvasSize.height) {
      return;
    }

    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasSize.width * dpr;
    canvas.height = canvasSize.height * dpr;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);

    const draw = (time: number) => {
      const width = canvasSize.width;
      const height = canvasSize.height;
      const centerX = width / 2;
      const centerY = height / 2;

      context.clearRect(0, 0, width, height);

      const coreX = centerX + (shouldAnimate ? Math.sin(time * 0.00007) * width * 0.015 : 0);
      const coreY = centerY + (shouldAnimate ? Math.cos(time * 0.00006) * height * 0.018 : 0);

      const nebulaA = context.createRadialGradient(
        coreX,
        coreY,
        0,
        coreX,
        coreY,
        width * (compact ? 0.18 : 0.3)
      );
      nebulaA.addColorStop(0, compact ? "rgba(245, 211, 138, 0.1)" : "rgba(245, 211, 138, 0.16)");
      nebulaA.addColorStop(0.34, compact ? "rgba(125, 211, 252, 0.06)" : "rgba(125, 211, 252, 0.1)");
      nebulaA.addColorStop(0.7, compact ? "rgba(196, 181, 253, 0.04)" : "rgba(196, 181, 253, 0.07)");
      nebulaA.addColorStop(1, GRAPH_BACKGROUND);
      context.fillStyle = nebulaA;
      context.fillRect(0, 0, width, height);

      const nebulaB = context.createRadialGradient(
        width * 0.28,
        height * 0.68,
        0,
        width * 0.28,
        height * 0.68,
        width * (compact ? 0.14 : 0.24)
      );
      nebulaB.addColorStop(0, compact ? "rgba(249, 168, 212, 0.05)" : "rgba(249, 168, 212, 0.09)");
      nebulaB.addColorStop(0.45, compact ? "rgba(125, 211, 252, 0.04)" : "rgba(125, 211, 252, 0.06)");
      nebulaB.addColorStop(1, GRAPH_BACKGROUND);
      context.fillStyle = nebulaB;
      context.fillRect(0, 0, width, height);

      const positions = new Map<string, { x: number; y: number; size: number }>();
      const nextRenderedNodes: RenderedNode[] = [];

      for (const node of motionNodes) {
        const position = getNodePosition(node, width, height, time, shouldAnimate);
        const screenX = centerX + (position.x - centerX) * viewport.scale + viewport.panX;
        const screenY = centerY + (position.y - centerY) * viewport.scale + viewport.panY;
        const radius = position.size * sizeScale * viewport.scale;

        positions.set(node.id, { x: screenX, y: screenY, size: radius });
        nextRenderedNodes.push({
          ...node,
          screenX,
          screenY,
          radius,
        });
      }

      renderedNodesRef.current = nextRenderedNodes;

      context.lineWidth = compact ? 0.65 : 0.9;
      for (const edge of edges) {
        const source = positions.get(edge.source);
        const target = positions.get(edge.target);

        if (!source || !target) {
          continue;
        }

        const isDimmedEdge = dimmedNodeIdSet.has(edge.source) || dimmedNodeIdSet.has(edge.target);
        const gradient = context.createLinearGradient(source.x, source.y, target.x, target.y);
        gradient.addColorStop(
          0,
          isDimmedEdge ? "rgba(88, 91, 102, 0.05)" : compact ? "rgba(160, 196, 255, 0.1)" : EDGE_COLOR
        );
        gradient.addColorStop(
          0.5,
          isDimmedEdge ? "rgba(88, 91, 102, 0.04)" : compact ? "rgba(245, 211, 138, 0.05)" : "rgba(245, 211, 138, 0.08)"
        );
        gradient.addColorStop(
          1,
          isDimmedEdge ? "rgba(88, 91, 102, 0.02)" : compact ? "rgba(255, 255, 255, 0.015)" : "rgba(255, 255, 255, 0.03)"
        );
        context.strokeStyle = gradient;
        context.beginPath();
        context.moveTo(source.x, source.y);
        context.lineTo(target.x, target.y);
        context.stroke();
      }

      for (const node of nextRenderedNodes) {
        const isSelected = node.id === selectedNodeId;
        const isHovered = node.id === hoveredNodeId;
        const isDimmed = dimmedNodeIdSet.has(node.id);

        context.save();
        context.globalAlpha = isDimmed ? 0.16 : 1;

        context.beginPath();
        context.fillStyle = node.isCore ? CORE_GLOW : NODE_GLOW;
        context.arc(
          node.screenX,
          node.screenY,
          node.radius + (node.isCore ? 34 * sizeScale : 15 * sizeScale),
          0,
          Math.PI * 2
        );
        context.fill();

        context.beginPath();
        context.fillStyle = node.color;
        context.arc(node.screenX, node.screenY, node.radius, 0, Math.PI * 2);
        context.fill();

        context.beginPath();
        context.strokeStyle = NODE_RING;
        context.lineWidth = compact ? 0.8 : 1;
        context.arc(
          node.screenX,
          node.screenY,
          node.radius + (node.isCore ? 10 * sizeScale : 6 * sizeScale),
          0,
          Math.PI * 2
        );
        context.stroke();

        if (isSelected || isHovered) {
          context.beginPath();
          context.strokeStyle = isSelected ? "rgba(255, 202, 122, 0.78)" : "rgba(255, 255, 255, 0.48)";
          context.lineWidth = isSelected ? 2.2 : 1.2;
          context.arc(node.screenX, node.screenY, node.radius + 12, 0, Math.PI * 2);
          context.stroke();
        }

        context.restore();
      }

      if (shouldAnimate) {
        frameRef.current = window.requestAnimationFrame(draw);
      }
    };

    draw(0);

    return () => {
      if (frameRef.current) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, [
    canvasSize.height,
    canvasSize.width,
    compact,
    dimmedNodeIdSet,
    edges,
    hoveredNodeId,
    motionNodes,
    selectedNodeId,
    shouldAnimate,
    sizeScale,
    viewport.panX,
    viewport.panY,
    viewport.scale,
  ]);

  function getNodeAtPoint(clientX: number, clientY: number) {
    const rect = containerRef.current?.getBoundingClientRect();

    if (!rect) {
      return null;
    }

    const localX = clientX - rect.left;
    const localY = clientY - rect.top;

    for (let index = renderedNodesRef.current.length - 1; index >= 0; index -= 1) {
      const node = renderedNodesRef.current[index];
      const hitRadius = Math.max(18, node.radius + 10);
      const distance = Math.hypot(node.screenX - localX, node.screenY - localY);

      if (distance <= hitRadius) {
        return node;
      }
    }

    return null;
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!interactive) {
      return;
    }

    pointerStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startPanX: viewport.panX,
      startPanY: viewport.panY,
      moved: false,
    };

    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!interactive) {
      return;
    }

    const pointerState = pointerStateRef.current;

    if (pointerState.pointerId === event.pointerId) {
      const deltaX = event.clientX - pointerState.startX;
      const deltaY = event.clientY - pointerState.startY;

      if (!pointerState.moved && Math.hypot(deltaX, deltaY) > DRAG_THRESHOLD) {
        pointerState.moved = true;
      }

      if (pointerState.moved) {
        setViewport(
          clampViewport({
            scale: viewport.scale,
            panX: pointerState.startPanX + deltaX,
            panY: pointerState.startPanY + deltaY,
          })
        );
        setHoveredNodeId(null);
        return;
      }
    }

    const hoveredNode = getNodeAtPoint(event.clientX, event.clientY);
    setHoveredNodeId(hoveredNode?.id || null);
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (!interactive) {
      return;
    }

    const pointerState = pointerStateRef.current;

    if (pointerState.pointerId !== event.pointerId) {
      return;
    }

    const hitNode = getNodeAtPoint(event.clientX, event.clientY);

    if (!pointerState.moved) {
      onNodeSelect?.(hitNode?.id || null);
    }

    pointerStateRef.current = {
      pointerId: null,
      startX: 0,
      startY: 0,
      startPanX: 0,
      startPanY: 0,
      moved: false,
    };

    event.currentTarget.releasePointerCapture(event.pointerId);
    setHoveredNodeId(hitNode?.id || null);
  }

  function handlePointerLeave() {
    if (pointerStateRef.current.pointerId === null) {
      setHoveredNodeId(null);
    }
  }

  function handleWheel(event: ReactWheelEvent<HTMLDivElement>) {
    if (!interactive || !canvasSize.width || !canvasSize.height) {
      return;
    }

    event.preventDefault();

    const rect = containerRef.current?.getBoundingClientRect();

    if (!rect) {
      return;
    }

    const pointerX = event.clientX - rect.left;
    const pointerY = event.clientY - rect.top;
    const centerX = canvasSize.width / 2;
    const centerY = canvasSize.height / 2;

    setViewport((current) => {
      const nextScale = clamp(current.scale * (event.deltaY < 0 ? 1.12 : 0.9), MIN_SCALE, MAX_SCALE);

      if (nextScale === current.scale) {
        return current;
      }

      const panX =
        pointerX -
        centerX -
        ((pointerX - centerX - current.panX) / current.scale) * nextScale;
      const panY =
        pointerY -
        centerY -
        ((pointerY - centerY - current.panY) / current.scale) * nextScale;

      return clampViewport({
        scale: nextScale,
        panX,
        panY,
      });
    });
  }

  const cursor =
    interactive && pointerStateRef.current.pointerId !== null && pointerStateRef.current.moved
      ? "grabbing"
      : interactive && hoveredNodeId
        ? "pointer"
        : interactive
          ? "grab"
          : "default";

  return (
    <div
      ref={containerRef}
      aria-hidden={!interactive}
      className={`relative h-full w-full overflow-hidden ${interactive ? "" : "pointer-events-none"} ${className}`}
      style={{ cursor, touchAction: interactive ? "none" : undefined }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
      onWheel={handleWheel}
    >
      <div
        className={`absolute inset-0 ${
          isLightLabelVariant
            ? "bg-[radial-gradient(circle_at_50%_48%,rgba(129,124,242,0.08),rgba(250,249,255,0.9)_60%,rgba(255,255,255,1)_100%)]"
            : compact
            ? "bg-[radial-gradient(circle_at_50%_50%,rgba(42,43,46,0.02),rgba(42,43,46,0.12)_60%,rgba(42,43,46,0.18)_100%)]"
            : "bg-[radial-gradient(circle_at_50%_50%,rgba(42,43,46,0.04),rgba(42,43,46,0.26)_62%,rgba(42,43,46,0.46)_100%)]"
        }`}
      />
      <canvas ref={canvasRef} className={`h-full w-full ${compact ? "opacity-[0.94]" : "opacity-[0.82]"}`} />

      {showLabels ? (
        <div className="pointer-events-none absolute inset-0">
          {renderedLabelNodes.map((node) => {
            const isSelected = node.id === selectedNodeId;
            const isHovered = node.id === hoveredNodeId;
            const isDimmed = dimmedNodeIdSet.has(node.id);
            const top = node.screenY + node.radius + 14;
            const fontSize = `${clamp(11 + (viewport.scale - 1) * 2.5, 11, 15)}px`;

            return (
              <div
                key={node.id}
                className={[
                  "absolute max-w-[11rem] -translate-x-1/2 rounded-full border px-2.5 py-1 text-center leading-tight shadow-[0_10px_24px_rgba(4,6,12,0.26)] transition-all duration-150",
                  isLightLabelVariant && isSelected
                    ? "border-[#817cf2]/35 bg-white text-[#817cf2] shadow-[0_10px_24px_rgba(129,124,242,0.16)]"
                    : isLightLabelVariant && isHovered
                      ? "border-[#817cf2]/28 bg-white text-[#24213d] shadow-[0_10px_24px_rgba(42,38,73,0.12)]"
                      : isLightLabelVariant && isDimmed
                        ? "border-[#ddd9f4] bg-white/45 text-[#aaa6c0]"
                        : isLightLabelVariant
                          ? "border-[#ddd9f4] bg-white/92 text-[#74708b] shadow-[0_10px_24px_rgba(42,38,73,0.08)]"
                          : isSelected
                    ? "border-[#f5d38a]/70 bg-[#2d2f35]/96 text-white"
                    : isHovered
                      ? "border-white/25 bg-[#282a31]/94 text-white/90"
                      : isDimmed
                        ? "border-white/5 bg-[#1f2127]/42 text-white/20"
                        : "border-white/10 bg-[#1f2127]/86 text-white/78",
                ].join(" ")}
                style={{
                  left: node.screenX,
                  top,
                  fontSize,
                }}
              >
                {node.label}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
