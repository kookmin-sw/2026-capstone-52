"use client";

import { useMemo } from "react";
import KnowledgeGraphScene from "@/components/graph/knowledge-graph-scene";
import {
  getReducedLandingGraphEdges,
  landingGraphBaseEdges,
  landingGraphBaseNodes,
  landingGraphReducedNodeIds,
} from "@/features/graph/layout";

type LandingGraphLayerProps = {
  compact?: boolean;
  className?: string;
  staticMode?: boolean;
  reduced?: boolean;
};

export function LandingGraphLayer({
  compact = false,
  className = "",
  staticMode = false,
  reduced = false,
}: LandingGraphLayerProps) {
  const nodes = useMemo(
    () =>
      landingGraphBaseNodes
        .filter((node) => (reduced ? landingGraphReducedNodeIds.has(node.id) : true))
        .map((node) => ({
          ...node,
          label: "",
          isCore: node.id === "n1",
        })),
    [reduced]
  );

  const edges = useMemo(
    () => (reduced ? getReducedLandingGraphEdges() : landingGraphBaseEdges),
    [reduced]
  );

  return (
    <KnowledgeGraphScene
      nodes={nodes}
      edges={edges}
      compact={compact}
      animated={!staticMode}
      className={className}
    />
  );
}
