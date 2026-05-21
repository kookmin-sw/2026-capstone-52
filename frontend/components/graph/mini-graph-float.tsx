"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { KnowledgeGraphEdge, KnowledgeGraphNode } from "@/components/graph/knowledge-graph-scene";

type MiniGraphFloatProps = {
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
  className?: string;
  showLabels?: boolean;
  nodeSizeScale?: number;
};

type FloatParams = {
  amplitudeX: number;
  amplitudeY: number;
  periodX: number;
  periodY: number;
  phaseX: number;
  phaseY: number;
};

type PositionedNode = KnowledgeGraphNode & {
  radius: number;
  seedX: number;
  seedY: number;
  x: number;
  y: number;
};

const GRID_COLOR = "rgba(36,33,61,0.045)";
const BACKGROUND_COLOR = "#fbfaff";
const TWO_PI = Math.PI * 2;

function hashString(value: string) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function createSeededRandom(seed: number) {
  return () => {
    seed += 0x6d2b79f5;
    let next = seed;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function makeFloatParams(nodeId: string): FloatParams {
  const random = createSeededRandom(hashString(nodeId));

  return {
    amplitudeX: 3.5 + random() * 3,
    amplitudeY: 3 + random() * 3,
    periodX: 4.8 + random() * 2.8,
    periodY: 4.2 + random() * 3.2,
    phaseX: random() * TWO_PI,
    phaseY: random() * TWO_PI,
  };
}

function truncateLabel(label: string, maxLength: number) {
  if (label.length <= maxLength) {
    return label;
  }

  return `${label.slice(0, maxLength - 1)}…`;
}

function drawGrid(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.save();
  ctx.strokeStyle = GRID_COLOR;
  ctx.lineWidth = 1;

  for (let x = 0; x <= width; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, height);
    ctx.stroke();
  }

  for (let y = 0; y <= height; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(width, y + 0.5);
    ctx.stroke();
  }

  ctx.restore();
}

function drawEdge(ctx: CanvasRenderingContext2D, source: PositionedNode, target: PositionedNode) {
  ctx.save();
  ctx.strokeStyle = "rgba(116,112,139,0.24)";
  ctx.lineWidth = 0.72;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(source.x, source.y);
  ctx.lineTo(target.x, target.y);
  ctx.stroke();
  ctx.restore();
}

function drawNode(
  ctx: CanvasRenderingContext2D,
  node: PositionedNode,
  showLabels: boolean
) {
  ctx.save();

  if (node.isCore) {
    ctx.beginPath();
    ctx.arc(node.x, node.y, node.radius + 5.5, 0, TWO_PI);
    ctx.fillStyle = `${node.color}22`;
    ctx.fill();
  }

  ctx.beginPath();
  ctx.arc(node.x, node.y, node.radius, 0, TWO_PI);
  ctx.fillStyle = node.color;
  ctx.shadowColor = node.color;
  ctx.shadowBlur = node.isCore ? 4 : 1;
  ctx.fill();
  ctx.shadowBlur = 0;

  if (node.isCore) {
    ctx.strokeStyle = "rgba(255,255,255,0.92)";
    ctx.lineWidth = 1.15;
    ctx.stroke();
  }

  if (showLabels && node.label) {
    const fontSize = node.isCore ? 10.6 : 9.3;
    const label = truncateLabel(node.label, node.isCore ? 24 : 18);

    ctx.font = `${node.isCore ? 700 : 560} ${fontSize}px "Pretendard Variable", system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = "rgba(98,96,124,0.92)";
    ctx.fillText(label, node.x, node.y + node.radius + 5);
  }

  ctx.restore();
}

export function MiniGraphFloat({
  nodes,
  edges,
  className = "",
  showLabels = false,
  nodeSizeScale = 1,
}: MiniGraphFloatProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  const floatParams = useMemo(() => nodes.map((node) => makeFloatParams(node.id)), [nodes]);

  const seedNodes = useMemo(() => {
    const width = dimensions.width;
    const height = dimensions.height;

    if (!width || !height) {
      return [];
    }

    const padding = 28;
    const innerWidth = Math.max(1, width - padding * 2);
    const innerHeight = Math.max(1, height - padding * 2);

    return nodes.map((node) => {
      const seedX = padding + node.x * innerWidth;
      const seedY = padding + node.y * innerHeight;
      const radius = Math.max(2.6, node.size * 1.7 * nodeSizeScale);

      return {
        ...node,
        radius,
        seedX,
        seedY,
        x: seedX,
        y: seedY,
      };
    });
  }, [dimensions.height, dimensions.width, nodeSizeScale, nodes]);

  const nodeIndexById = useMemo(() => {
    const indexById = new Map<string, number>();
    nodes.forEach((node, index) => indexById.set(node.id, index));
    return indexById;
  }, [nodes]);

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
          height: Math.max(1, Math.floor(rect.height)),
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
    const canvas = canvasRef.current;

    if (!canvas || !dimensions.width || !dimensions.height || !seedNodes.length) {
      return;
    }

    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(dimensions.width * dpr);
    canvas.height = Math.floor(dimensions.height * dpr);
    canvas.style.width = `${dimensions.width}px`;
    canvas.style.height = `${dimensions.height}px`;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);

    let animationFrame = 0;
    let startTime = window.performance.now();

    const draw = (time: number) => {
      const elapsed = (time - startTime) / 1000;

      context.clearRect(0, 0, dimensions.width, dimensions.height);
      context.fillStyle = BACKGROUND_COLOR;
      context.fillRect(0, 0, dimensions.width, dimensions.height);
      drawGrid(context, dimensions.width, dimensions.height);

      const positionedNodes = seedNodes.map((node, index) => {
        const params = floatParams[index];

        return {
          ...node,
          x: node.seedX + params.amplitudeX * Math.sin((TWO_PI * elapsed) / params.periodX + params.phaseX),
          y: node.seedY + params.amplitudeY * Math.cos((TWO_PI * elapsed) / params.periodY + params.phaseY),
        };
      });

      edges.forEach((edge) => {
        const sourceIndex = nodeIndexById.get(edge.source);
        const targetIndex = nodeIndexById.get(edge.target);

        if (sourceIndex === undefined || targetIndex === undefined) {
          return;
        }

        drawEdge(context, positionedNodes[sourceIndex], positionedNodes[targetIndex]);
      });

      positionedNodes.forEach((node) => drawNode(context, node, showLabels));

      animationFrame = window.requestAnimationFrame(draw);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        window.cancelAnimationFrame(animationFrame);
        return;
      }

      window.cancelAnimationFrame(animationFrame);
      startTime = window.performance.now();
      animationFrame = window.requestAnimationFrame(draw);
    };

    animationFrame = window.requestAnimationFrame(draw);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [dimensions.height, dimensions.width, edges, floatParams, nodeIndexById, seedNodes, showLabels]);

  return (
    <div ref={containerRef} className={`relative h-full w-full overflow-hidden ${className}`}>
      <canvas ref={canvasRef} className="block h-full w-full" aria-hidden="true" />
    </div>
  );
}
