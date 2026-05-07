import { dashboardGraphSlotIds, getGraphLayoutSlot } from "../graph/layout";
import type { Chat } from "./types";

export type ProjectKnowledgeGraphEvent = {
  id: string;
  chatId: string;
  messageId: string | null;
  preview: string;
  updatedAt: string;
};

export type ProjectKnowledgeGraphNode = {
  id: string;
  label: string;
  x: number;
  y: number;
  size: number;
  color: string;
  isCore?: boolean;
  kind: "concept" | "chat" | "project";
  subtitle: string;
  description: string;
  relatedConceptIds: string[];
  relatedLearningEvents: ProjectKnowledgeGraphEvent[];
  keywords?: string[];
};

export type ProjectKnowledgeGraphEdge = {
  source: string;
  target: string;
};

export type ProjectKnowledgeGraphData = {
  nodes: ProjectKnowledgeGraphNode[];
  edges: ProjectKnowledgeGraphEdge[];
  defaultSelectedNodeId: string | null;
};

type BackendGraphNode = {
  node_id: string;
  name: string;
  description?: string | null;
  group?: string | null;
  status?: string | null;
  updated_at?: string | null;
};

type BackendGraphEdge = {
  source_node_id: string;
  target_node_id: string;
};

type BackendGraphData = {
  nodes?: BackendGraphNode[];
  edges?: BackendGraphEdge[];
};

type ProjectDataInput = {
  projectId: string;
  title: string;
};

type IntegratedProjectGraphInput = {
  project: ProjectDataInput;
  graph: ProjectKnowledgeGraphData;
};

type GraphConceptPreset = {
  key: string;
  label: string;
  description: string;
  relatedKeys: string[];
  keywords: string[];
};

type GraphProjectPreset = {
  subject: string;
  coreLabel: string;
  coreDescription: string;
  coreKeywords: string[];
  concepts: GraphConceptPreset[];
};

const graphProjectPresets: Record<string, GraphProjectPreset> = {
  calculus: {
    subject: "미적분",
    coreLabel: "접선",
    coreDescription: "곡선 위 한 점에서의 순간 변화 방향을 대표하는 핵심 개념입니다.",
    coreKeywords: ["접선", "기울기", "변화율", "미분계수"],
    concepts: [
      {
        key: "slope",
        label: "기울기",
        description: "직선이나 접선이 얼마나 가파르게 변하는지를 나타내는 값입니다.",
        relatedKeys: ["rate", "line-equation", "tangent"],
        keywords: ["기울기", "slope"],
      },
      {
        key: "rate",
        label: "변화율",
        description: "입력값이 변할 때 출력값이 얼마나 바뀌는지 보는 관점입니다.",
        relatedKeys: ["slope", "derivative"],
        keywords: ["변화율", "평균변화율", "순간 변화율"],
      },
      {
        key: "derivative",
        label: "미분계수",
        description: "한 점에서의 순간 변화율을 수식으로 표현한 값입니다.",
        relatedKeys: ["rate", "tangent"],
        keywords: ["미분계수", "미분"],
      },
      {
        key: "line-equation",
        label: "직선의 방정식",
        description: "기울기와 한 점을 이용해 접선의 식을 세울 때 연결되는 표현입니다.",
        relatedKeys: ["slope", "tangent"],
        keywords: ["직선의 방정식", "방정식", "점기울기"],
      },
      {
        key: "tangent",
        label: "순간 변화율",
        description: "접선이 특정 점에서 곡선의 변화를 대표한다는 해석을 담고 있습니다.",
        relatedKeys: ["slope", "rate", "derivative"],
        keywords: ["접선", "순간 변화율"],
      },
    ],
  },
  os: {
    subject: "운영체제",
    coreLabel: "스케줄링",
    coreDescription: "CPU를 어떤 작업에 언제 배분할지 결정하는 운영체제의 핵심 메커니즘입니다.",
    coreKeywords: ["스케줄링", "우선순위", "기아", "round robin", "fcfs"],
    concepts: [
      {
        key: "priority",
        label: "우선순위",
        description: "프로세스 간 처리 순서를 정할 때 사용하는 기준입니다.",
        relatedKeys: ["starvation", "aging"],
        keywords: ["우선순위", "priority"],
      },
      {
        key: "starvation",
        label: "기아 현상",
        description: "낮은 우선순위 작업이 계속 실행 기회를 얻지 못하는 현상입니다.",
        relatedKeys: ["priority", "aging"],
        keywords: ["기아", "starvation"],
      },
      {
        key: "aging",
        label: "에이징",
        description: "오래 기다린 프로세스의 우선순위를 높여 기아 현상을 줄이는 기법입니다.",
        relatedKeys: ["priority", "starvation"],
        keywords: ["에이징", "aging"],
      },
      {
        key: "rr",
        label: "Round Robin",
        description: "고정된 time quantum 단위로 CPU를 순환 배분하는 스케줄링 방식입니다.",
        relatedKeys: ["fcfs", "priority"],
        keywords: ["round robin", "rr", "time quantum"],
      },
      {
        key: "fcfs",
        label: "FCFS",
        description: "먼저 들어온 작업을 먼저 처리하는 가장 단순한 스케줄링 방식입니다.",
        relatedKeys: ["rr", "priority"],
        keywords: ["fcfs", "first come first served"],
      },
    ],
  },
  ml: {
    subject: "머신러닝",
    coreLabel: "모델 학습",
    coreDescription: "데이터를 바탕으로 패턴을 찾고 예측 성능을 높이는 전체 과정을 묶는 중심 개념입니다.",
    coreKeywords: ["정규화", "손실", "경사하강법", "과적합"],
    concepts: [
      {
        key: "normalization",
        label: "정규화",
        description: "특성 스케일을 맞춰 학습이 안정적으로 진행되도록 돕는 전처리입니다.",
        relatedKeys: ["gradient", "feature-scale"],
        keywords: ["정규화", "스케일", "표준화"],
      },
      {
        key: "loss",
        label: "손실 함수",
        description: "모델 예측이 얼마나 틀렸는지 수치로 나타내는 기준입니다.",
        relatedKeys: ["gradient", "overfitting"],
        keywords: ["손실", "loss", "cost"],
      },
      {
        key: "gradient",
        label: "경사하강법",
        description: "손실을 줄이는 방향으로 파라미터를 갱신하는 최적화 방법입니다.",
        relatedKeys: ["loss", "normalization"],
        keywords: ["경사하강법", "gradient", "optimizer"],
      },
      {
        key: "overfitting",
        label: "과적합",
        description: "학습 데이터에는 잘 맞지만 새로운 데이터에는 약한 상태를 의미합니다.",
        relatedKeys: ["loss", "feature-scale"],
        keywords: ["과적합", "overfitting", "regularization"],
      },
      {
        key: "feature-scale",
        label: "특징 스케일",
        description: "입력 특성의 크기 차이가 학습 안정성과 속도에 미치는 영향을 다룹니다.",
        relatedKeys: ["normalization", "gradient"],
        keywords: ["feature", "특성", "스케일"],
      },
    ],
  },
  db: {
    subject: "데이터베이스",
    coreLabel: "SQL 학습",
    coreDescription: "관계형 데이터베이스를 조회하고 설계하는 핵심 문법과 개념을 묶는 중심 노드입니다.",
    coreKeywords: ["join", "인덱스", "트랜잭션", "정규화"],
    concepts: [
      {
        key: "join",
        label: "JOIN",
        description: "여러 테이블을 공통 키를 기준으로 결합하는 조회 방식입니다.",
        relatedKeys: ["index", "plan"],
        keywords: ["join", "inner join", "left join", "right join"],
      },
      {
        key: "index",
        label: "인덱스",
        description: "조회 속도를 높이기 위한 탐색 구조로, 조건 검색과 밀접하게 연결됩니다.",
        relatedKeys: ["join", "plan"],
        keywords: ["인덱스", "index"],
      },
      {
        key: "transaction",
        label: "트랜잭션",
        description: "데이터 변경 작업을 하나의 안전한 단위로 묶어 처리하는 개념입니다.",
        relatedKeys: ["normalization", "plan"],
        keywords: ["트랜잭션", "transaction", "commit", "rollback"],
      },
      {
        key: "normalization",
        label: "정규화",
        description: "중복을 줄이고 데이터 일관성을 높이도록 테이블을 구조화하는 과정입니다.",
        relatedKeys: ["transaction", "join"],
        keywords: ["정규화", "normalization"],
      },
      {
        key: "plan",
        label: "실행 계획",
        description: "쿼리를 어떻게 수행할지 DB 엔진이 선택한 절차를 보여주는 정보입니다.",
        relatedKeys: ["join", "index"],
        keywords: ["실행 계획", "execution plan", "explain"],
      },
    ],
  },
  network: {
    subject: "네트워크",
    coreLabel: "TCP",
    coreDescription: "신뢰성 있는 전송을 위해 연결 수립, 흐름 제어, 혼잡 제어를 담당하는 핵심 프로토콜입니다.",
    coreKeywords: ["tcp", "handshake", "흐름 제어", "혼잡 제어"],
    concepts: [
      {
        key: "handshake",
        label: "3-way handshake",
        description: "TCP 연결을 수립할 때 클라이언트와 서버가 주고받는 세 단계 절차입니다.",
        relatedKeys: ["flow-control", "ack"],
        keywords: ["3-way", "handshake", "syn", "ack"],
      },
      {
        key: "flow-control",
        label: "흐름 제어",
        description: "수신 측이 처리 가능한 만큼만 데이터를 보내도록 조절하는 메커니즘입니다.",
        relatedKeys: ["congestion", "ack"],
        keywords: ["흐름 제어", "flow control", "window"],
      },
      {
        key: "congestion",
        label: "혼잡 제어",
        description: "네트워크가 과부하 상태에 빠지지 않도록 전송량을 조절하는 전략입니다.",
        relatedKeys: ["flow-control", "routing"],
        keywords: ["혼잡", "congestion", "slow start"],
      },
      {
        key: "ack",
        label: "ACK",
        description: "상대가 데이터를 정상적으로 받았는지 확인하기 위해 보내는 응답 신호입니다.",
        relatedKeys: ["handshake", "flow-control"],
        keywords: ["ack", "응답", "재전송"],
      },
      {
        key: "routing",
        label: "라우팅",
        description: "패킷이 목적지까지 어떤 경로로 이동할지 결정하는 과정입니다.",
        relatedKeys: ["congestion", "flow-control"],
        keywords: ["라우팅", "routing", "경로"],
      },
    ],
  },
};

function uniqueById<T extends { id: string }>(items: T[]) {
  const seen = new Set<string>();

  return items.filter((item) => {
    if (seen.has(item.id)) {
      return false;
    }

    seen.add(item.id);
    return true;
  });
}

function uniqueStrings(items: string[]) {
  return [...new Set(items)];
}

function uniqueEdges(edges: ProjectKnowledgeGraphEdge[]) {
  const seen = new Set<string>();

  return edges.filter((edge) => {
    const key = [edge.source, edge.target].sort().join("::");

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function truncateLabel(label: string, maxLength = 28) {
  return label.length > maxLength ? `${label.slice(0, maxLength - 1)}…` : label;
}

function buildPreview(chat: Chat) {
  const firstUserMessage = chat.messages.find((message) => message.role === "user") || chat.messages[0] || null;

  return {
    messageId: firstUserMessage?.id || null,
    preview: firstUserMessage?.text || chat.title,
  };
}

function findConceptMatches(text: string, conceptNodes: ProjectKnowledgeGraphNode[]) {
  const normalized = text.toLowerCase();
  const matches = conceptNodes
    .filter((concept) =>
      (concept.keywords || []).some((keyword) => normalized.includes(keyword.toLowerCase()))
    )
    .map((concept) => concept.id);

  return matches;
}

function buildConceptNodeId(projectId: string, key: string) {
  return `${projectId}-concept-${key}`;
}

function buildPresetGraph(projectData: ProjectDataInput, chats: Chat[], preset: GraphProjectPreset): ProjectKnowledgeGraphData {
  const coreSlot = getGraphLayoutSlot(dashboardGraphSlotIds.core);

  if (!coreSlot) {
    return { nodes: [], edges: [], defaultSelectedNodeId: null };
  }

  const coreNodeId = `${projectData.projectId}-core`;
  const conceptNodes = preset.concepts
    .map((concept, index) => {
      const slot = getGraphLayoutSlot(dashboardGraphSlotIds.concept[index]);

      if (!slot) {
        return null;
      }

      return {
        id: buildConceptNodeId(projectData.projectId, concept.key),
        label: concept.label,
        x: slot.x,
        y: slot.y,
        size: slot.size + 0.35,
        color: slot.color,
        kind: "concept" as const,
        subtitle: preset.subject,
        description: concept.description,
        relatedConceptIds: concept.relatedKeys.map((key) => buildConceptNodeId(projectData.projectId, key)),
        relatedLearningEvents: [],
        keywords: concept.keywords,
      };
    })
    .filter(Boolean) as ProjectKnowledgeGraphNode[];

  const coreNode: ProjectKnowledgeGraphNode = {
    id: coreNodeId,
    label: preset.coreLabel,
    x: coreSlot.x,
    y: coreSlot.y,
    size: coreSlot.size + 0.8,
    color: coreSlot.color,
    isCore: true,
    kind: "concept",
    subtitle: preset.subject,
    description: preset.coreDescription,
    relatedConceptIds: conceptNodes.map((node) => node.id),
    relatedLearningEvents: [],
    keywords: preset.coreKeywords,
  };

  const baseEdges: ProjectKnowledgeGraphEdge[] = conceptNodes.map((node) => ({
    source: coreNodeId,
    target: node.id,
  }));

  conceptNodes.forEach((node) => {
    node.relatedConceptIds.forEach((relatedId) => {
      baseEdges.push({ source: node.id, target: relatedId });
    });
  });

  const chatNodes = chats
    .slice(0, dashboardGraphSlotIds.chat.length)
    .flatMap((chat, index): ProjectKnowledgeGraphNode[] => {
      const slot = getGraphLayoutSlot(dashboardGraphSlotIds.chat[index]);
      const previewInfo = buildPreview(chat);

      if (!slot) {
        return [];
      }

      const relatedConceptIds = findConceptMatches(
        `${chat.title} ${chat.messages.map((message) => message.text).join(" ")}`,
        conceptNodes
      );
      const nextRelatedConceptIds = relatedConceptIds.length ? relatedConceptIds : [coreNodeId];
      const learningEvent: ProjectKnowledgeGraphEvent = {
        id: `event-${chat.id}`,
        chatId: chat.id,
        messageId: previewInfo.messageId,
        preview: previewInfo.preview,
        updatedAt: chat.updatedAt,
      };

      nextRelatedConceptIds.forEach((conceptId) => {
        const targetNode = conceptId === coreNodeId ? coreNode : conceptNodes.find((node) => node.id === conceptId);

        if (targetNode) {
          targetNode.relatedLearningEvents.push(learningEvent);
        }
      });

      if (!nextRelatedConceptIds.includes(coreNodeId)) {
        coreNode.relatedLearningEvents.push(learningEvent);
      }

      nextRelatedConceptIds.forEach((conceptId) => {
        baseEdges.push({ source: `chat-${chat.id}`, target: conceptId });
      });

      return [
        {
          id: `chat-${chat.id}`,
          label: truncateLabel(chat.title),
          x: slot.x,
          y: slot.y,
          size: slot.size,
          color: slot.color,
          kind: "chat" as const,
          subtitle: "최근 학습 경험",
          description: `${projectData.title} 안에서 진행한 대화입니다. "${previewInfo.preview}"를 중심으로 학습이 이어졌습니다.`,
          relatedConceptIds: nextRelatedConceptIds.filter((conceptId) => conceptId !== coreNodeId),
          relatedLearningEvents: [learningEvent],
        },
      ];
    });

  const finalizedNodes: ProjectKnowledgeGraphNode[] = [
    coreNode,
    ...conceptNodes,
    ...chatNodes,
  ];

  return {
    nodes: uniqueById(finalizedNodes).map((node) => ({
      ...node,
      relatedLearningEvents: uniqueById(node.relatedLearningEvents),
    })),
    edges: uniqueEdges(baseEdges),
    defaultSelectedNodeId: coreNode.id,
  };
}

function buildGenericProjectGraph(projectData: ProjectDataInput, chats: Chat[]): ProjectKnowledgeGraphData {
  const coreSlot = getGraphLayoutSlot(dashboardGraphSlotIds.core);

  if (!coreSlot) {
    return { nodes: [], edges: [], defaultSelectedNodeId: null };
  }

  const coreNodeId = `${projectData.projectId}-project-core`;
  const coreNode: ProjectKnowledgeGraphNode = {
    id: coreNodeId,
    label: projectData.title,
    x: coreSlot.x,
    y: coreSlot.y,
    size: coreSlot.size + 0.8,
    color: coreSlot.color,
    isCore: true,
    kind: "project",
    subtitle: "프로젝트 중심",
    description: "아직 개념 그래프가 정리되지 않은 프로젝트입니다. 현재는 이 프로젝트 안에서 만들어진 채팅 흐름을 중심으로 그래프를 구성합니다.",
    relatedConceptIds: [],
    relatedLearningEvents: [],
  };

  const chatNodes = chats
    .slice(0, dashboardGraphSlotIds.chat.length)
    .flatMap((chat, index): ProjectKnowledgeGraphNode[] => {
      const slot = getGraphLayoutSlot(dashboardGraphSlotIds.chat[index]);
      const previewInfo = buildPreview(chat);
      const learningEvent: ProjectKnowledgeGraphEvent = {
        id: `event-${chat.id}`,
        chatId: chat.id,
        messageId: previewInfo.messageId,
        preview: previewInfo.preview,
        updatedAt: chat.updatedAt,
      };

      coreNode.relatedLearningEvents.push(learningEvent);

      if (!slot) {
        return [];
      }

      return [
        {
          id: `chat-${chat.id}`,
          label: truncateLabel(chat.title),
          x: slot.x,
          y: slot.y,
          size: slot.size,
          color: slot.color,
          kind: "chat" as const,
          subtitle: "최근 학습 경험",
          description: `${projectData.title} 안에서 진행한 대화입니다. "${previewInfo.preview}"를 중심으로 학습이 이어졌습니다.`,
          relatedConceptIds: [],
          relatedLearningEvents: [learningEvent],
        },
      ];
    });

  const finalizedNodes: ProjectKnowledgeGraphNode[] = [
    coreNode,
    ...chatNodes,
  ];

  return {
    nodes: uniqueById(finalizedNodes).map((node) => ({
      ...node,
      relatedLearningEvents: uniqueById(node.relatedLearningEvents),
    })),
    edges: uniqueEdges(
      chatNodes
        .filter(Boolean)
        .map((chatNode) => ({
          source: coreNodeId,
          target: chatNode!.id,
        }))
    ),
    defaultSelectedNodeId: coreNode.id,
  };
}

export function buildProjectKnowledgeGraph(projectData: ProjectDataInput | null, chats: Chat[]) {
  if (!projectData) {
    return {
      nodes: [],
      edges: [],
      defaultSelectedNodeId: null,
    } satisfies ProjectKnowledgeGraphData;
  }

  const preset = graphProjectPresets[projectData.projectId];

  return preset
    ? buildPresetGraph(projectData, chats, preset)
    : buildGenericProjectGraph(projectData, chats);
}

export function buildBackendKnowledgeGraph(
  projectData: ProjectDataInput | null,
  backendGraph: BackendGraphData | null,
  chats: Chat[]
) {
  if (!projectData || !backendGraph?.nodes?.length) {
    return buildProjectKnowledgeGraph(projectData, chats);
  }

  const nodesById = new Map(backendGraph.nodes.map((node) => [node.node_id, node]));
  const relatedIdsByNode = new Map<string, string[]>();

  (backendGraph.edges || []).forEach((edge) => {
    if (!nodesById.has(edge.source_node_id) || !nodesById.has(edge.target_node_id)) {
      return;
    }

    relatedIdsByNode.set(edge.source_node_id, [
      ...(relatedIdsByNode.get(edge.source_node_id) || []),
      edge.target_node_id,
    ]);
    relatedIdsByNode.set(edge.target_node_id, [
      ...(relatedIdsByNode.get(edge.target_node_id) || []),
      edge.source_node_id,
    ]);
  });

  const uiNodes = backendGraph.nodes.map((node, index) => {
    const slot =
      getGraphLayoutSlot(index === 0 ? dashboardGraphSlotIds.core : dashboardGraphSlotIds.concept[(index - 1) % dashboardGraphSlotIds.concept.length]);
    const fallbackAngle = (Math.PI * 2 * index) / Math.max(backendGraph.nodes!.length, 1);
    const fallbackRadius = index === 0 ? 0 : 0.28;
    const x = slot?.x ?? 0.5 + Math.cos(fallbackAngle) * fallbackRadius;
    const y = slot?.y ?? 0.5 + Math.sin(fallbackAngle) * fallbackRadius;
    const chatEvents = chats.flatMap((chat) => {
      const matched = `${chat.title} ${chat.messages.map((message) => message.text).join(" ")}`
        .toLowerCase()
        .includes(node.name.toLowerCase());

      if (!matched) {
        return [];
      }

      const preview = buildPreview(chat);

      return [
        {
          id: `event-${chat.id}-${node.node_id}`,
          chatId: chat.id,
          messageId: preview.messageId,
          preview: preview.preview,
          updatedAt: chat.updatedAt,
        },
      ];
    });

    return {
      id: node.node_id,
      label: node.name,
      x,
      y,
      size: (slot?.size || 1) + (index === 0 ? 0.55 : 0.18),
      color: slot?.color || "#8b5cf6",
      isCore: index === 0,
      kind: "concept" as const,
      subtitle: node.group || node.status || "개념 노드",
      description: node.description || "아직 개념 설명이 없습니다.",
      relatedConceptIds: uniqueStrings(relatedIdsByNode.get(node.node_id) || []),
      relatedLearningEvents: uniqueById(chatEvents),
      keywords: [node.name],
    };
  });

  return {
    nodes: uiNodes,
    edges: uniqueEdges(
      (backendGraph.edges || [])
        .filter((edge) => nodesById.has(edge.source_node_id) && nodesById.has(edge.target_node_id))
        .map((edge) => ({
          source: edge.source_node_id,
          target: edge.target_node_id,
        }))
    ),
    defaultSelectedNodeId: uiNodes[0]?.id || null,
  } satisfies ProjectKnowledgeGraphData;
}

export function buildIntegratedKnowledgeGraph(projectGraphs: IntegratedProjectGraphInput[]) {
  const clusterCenters = [
    { x: 0.28, y: 0.28 },
    { x: 0.68, y: 0.28 },
    { x: 0.3, y: 0.68 },
    { x: 0.7, y: 0.68 },
    { x: 0.5, y: 0.5 },
    { x: 0.18, y: 0.5 },
    { x: 0.82, y: 0.5 },
  ];
  const clusterScale = projectGraphs.length > 4 ? 0.28 : 0.34;
  const nodes: ProjectKnowledgeGraphNode[] = [];
  const edges: ProjectKnowledgeGraphEdge[] = [];

  projectGraphs.forEach(({ project, graph }, index) => {
    const center = clusterCenters[index % clusterCenters.length];
    const offsetTurn = Math.floor(index / clusterCenters.length);
    const offsetX = offsetTurn ? Math.sin(index * 1.7) * 0.04 : 0;
    const offsetY = offsetTurn ? Math.cos(index * 1.3) * 0.04 : 0;

    graph.nodes.forEach((node) => {
      nodes.push({
        ...node,
        id: `${project.projectId}::${node.id}`,
        x: Math.min(Math.max(center.x + offsetX + (node.x - 0.5) * clusterScale, 0.06), 0.94),
        y: Math.min(Math.max(center.y + offsetY + (node.y - 0.5) * clusterScale, 0.08), 0.92),
        size: node.isCore ? node.size * 0.82 : node.size * 0.72,
        subtitle: `${project.title} · ${node.subtitle}`,
        relatedConceptIds: node.relatedConceptIds.map((nodeId) => `${project.projectId}::${nodeId}`),
      });
    });

    graph.edges.forEach((edge) => {
      edges.push({
        source: `${project.projectId}::${edge.source}`,
        target: `${project.projectId}::${edge.target}`,
      });
    });
  });

  return {
    nodes: uniqueById(nodes),
    edges: uniqueEdges(edges),
    defaultSelectedNodeId: nodes.find((node) => node.isCore)?.id || nodes[0]?.id || null,
  } satisfies ProjectKnowledgeGraphData;
}
