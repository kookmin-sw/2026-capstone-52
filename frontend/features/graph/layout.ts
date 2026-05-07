export type GraphLayoutNode = {
  id: string;
  x: number;
  y: number;
  size: number;
  color: string;
};

export type GraphLayoutEdge = {
  source: string;
  target: string;
};

export const landingGraphBaseNodes: GraphLayoutNode[] = [
  { id: "n1", x: 0.5, y: 0.52, size: 6.8, color: "#f5d38a" },
  { id: "n2", x: 0.38, y: 0.38, size: 5.2, color: "#7dd3fc" },
  { id: "n3", x: 0.3, y: 0.28, size: 4.2, color: "#f9a8d4" },
  { id: "n4", x: 0.44, y: 0.28, size: 4.5, color: "#93c5fd" },
  { id: "n5", x: 0.59, y: 0.31, size: 4.4, color: "#c4b5fd" },
  { id: "n6", x: 0.68, y: 0.39, size: 4.8, color: "#7dd3fc" },
  { id: "n7", x: 0.27, y: 0.43, size: 4.1, color: "#93c5fd" },
  { id: "n8", x: 0.36, y: 0.5, size: 3.8, color: "#f9a8d4" },
  { id: "n9", x: 0.43, y: 0.61, size: 4.7, color: "#93c5fd" },
  { id: "n10", x: 0.57, y: 0.64, size: 4.4, color: "#c4b5fd" },
  { id: "n11", x: 0.69, y: 0.58, size: 4.8, color: "#93c5fd" },
  { id: "n12", x: 0.77, y: 0.48, size: 4.2, color: "#7dd3fc" },
  { id: "n13", x: 0.2, y: 0.62, size: 4.1, color: "#f9a8d4" },
  { id: "n14", x: 0.32, y: 0.72, size: 4.1, color: "#7dd3fc" },
  { id: "n15", x: 0.5, y: 0.79, size: 5.1, color: "#93c5fd" },
  { id: "n16", x: 0.65, y: 0.74, size: 4.1, color: "#c4b5fd" },
  { id: "n17", x: 0.78, y: 0.67, size: 3.9, color: "#f9a8d4" },
  { id: "n18", x: 0.13, y: 0.25, size: 3.4, color: "#93c5fd" },
  { id: "n19", x: 0.21, y: 0.17, size: 3.2, color: "#7dd3fc" },
  { id: "n20", x: 0.81, y: 0.23, size: 3.4, color: "#c4b5fd" },
  { id: "n21", x: 0.88, y: 0.36, size: 3.3, color: "#f9a8d4" },
  { id: "n22", x: 0.87, y: 0.58, size: 3.4, color: "#93c5fd" },
  { id: "n23", x: 0.81, y: 0.82, size: 3.5, color: "#7dd3fc" },
  { id: "n24", x: 0.64, y: 0.9, size: 3.2, color: "#c4b5fd" },
  { id: "n25", x: 0.46, y: 0.91, size: 3.3, color: "#f9a8d4" },
  { id: "n26", x: 0.28, y: 0.88, size: 3.5, color: "#93c5fd" },
  { id: "n27", x: 0.14, y: 0.76, size: 3.2, color: "#7dd3fc" },
  { id: "n28", x: 0.1, y: 0.52, size: 3.4, color: "#c4b5fd" },
];

export const landingGraphBaseEdges: GraphLayoutEdge[] = [
  { source: "n1", target: "n2" },
  { source: "n1", target: "n4" },
  { source: "n1", target: "n6" },
  { source: "n1", target: "n9" },
  { source: "n1", target: "n11" },
  { source: "n1", target: "n15" },
  { source: "n2", target: "n3" },
  { source: "n2", target: "n7" },
  { source: "n2", target: "n8" },
  { source: "n3", target: "n18" },
  { source: "n3", target: "n19" },
  { source: "n4", target: "n5" },
  { source: "n5", target: "n6" },
  { source: "n6", target: "n12" },
  { source: "n6", target: "n20" },
  { source: "n7", target: "n13" },
  { source: "n8", target: "n9" },
  { source: "n9", target: "n10" },
  { source: "n9", target: "n14" },
  { source: "n9", target: "n15" },
  { source: "n10", target: "n11" },
  { source: "n10", target: "n16" },
  { source: "n11", target: "n12" },
  { source: "n11", target: "n17" },
  { source: "n12", target: "n21" },
  { source: "n12", target: "n22" },
  { source: "n13", target: "n14" },
  { source: "n13", target: "n28" },
  { source: "n14", target: "n15" },
  { source: "n14", target: "n26" },
  { source: "n15", target: "n16" },
  { source: "n15", target: "n24" },
  { source: "n15", target: "n25" },
  { source: "n16", target: "n17" },
  { source: "n17", target: "n22" },
  { source: "n17", target: "n23" },
  { source: "n18", target: "n19" },
  { source: "n19", target: "n20" },
  { source: "n20", target: "n21" },
  { source: "n21", target: "n22" },
  { source: "n22", target: "n23" },
  { source: "n23", target: "n24" },
  { source: "n24", target: "n25" },
  { source: "n25", target: "n26" },
  { source: "n26", target: "n27" },
  { source: "n27", target: "n28" },
  { source: "n28", target: "n18" },
];

export const landingGraphReducedNodeIds = new Set([
  "n1",
  "n2",
  "n4",
  "n6",
  "n9",
  "n11",
  "n12",
  "n13",
  "n15",
  "n18",
  "n22",
  "n26",
]);

export const dashboardGraphSlotIds = {
  core: "n1",
  concept: ["n2", "n4", "n6", "n9", "n11", "n12", "n13", "n15", "n18", "n22", "n26"],
  chat: ["n3", "n5", "n7", "n8", "n10", "n14", "n16", "n17", "n19", "n20", "n21", "n23", "n24", "n25", "n27", "n28"],
} as const;

const layoutNodeMap = new Map(landingGraphBaseNodes.map((node) => [node.id, node]));

export function getGraphLayoutSlot(slotId: string) {
  return layoutNodeMap.get(slotId) || null;
}

export function getReducedLandingGraphEdges() {
  const filteredEdges = landingGraphBaseEdges.filter(
    (edge) => landingGraphReducedNodeIds.has(edge.source) && landingGraphReducedNodeIds.has(edge.target)
  );
  const connectedIds = new Set(filteredEdges.flatMap((edge) => [edge.source, edge.target]));
  const fallbackEdges: GraphLayoutEdge[] = [];

  for (const nodeId of landingGraphReducedNodeIds) {
    if (connectedIds.has(nodeId)) {
      continue;
    }

    const sourceNode = getGraphLayoutSlot(nodeId);

    if (!sourceNode) {
      continue;
    }

    let nearestNodeId: string | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (const candidateId of landingGraphReducedNodeIds) {
      if (candidateId === nodeId) {
        continue;
      }

      const targetNode = getGraphLayoutSlot(candidateId);

      if (!targetNode) {
        continue;
      }

      const distance = Math.hypot(sourceNode.x - targetNode.x, sourceNode.y - targetNode.y);

      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestNodeId = candidateId;
      }
    }

    if (nearestNodeId) {
      fallbackEdges.push({ source: nodeId, target: nearestNodeId });
    }
  }

  return [...filteredEdges, ...fallbackEdges];
}
