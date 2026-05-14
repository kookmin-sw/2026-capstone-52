export const projectCatalog = {
  os: {
    title: "운영체제",
    materials: [
      { id: "os-doc-1", name: "프로세스와_스레드.pdf", status: "수준진단 대기" },
      { id: "os-doc-2", name: "CPU_스케줄링_정리.pdf", status: "그냥 진행 가능" }
    ],
    chatMessages: [
      {
        id: "os-assistant-1",
        role: "assistant",
        text: "운영체제 학습을 시작했어요. 프로세스, 스케줄링, 메모리 관리 중 먼저 정리할 주제를 골라보세요."
      },
      {
        id: "os-user-1",
        role: "user",
        text: "Round Robin과 FCFS의 차이를 알려줘."
      },
      {
        id: "os-assistant-2",
        role: "assistant",
        text: "FCFS는 먼저 들어온 작업을 끝까지 처리하고, Round Robin은 time quantum마다 CPU를 순환 배분합니다."
      }
    ],
    graphNodes: ["프로세스", "스레드", "스케줄링", "Round Robin", "기아 현상"]
  },
  "data-structures": {
    title: "자료구조",
    materials: [
      { id: "ds-doc-1", name: "스택_큐_트리_요약.pdf", status: "수준진단 대기" },
      { id: "ds-doc-2", name: "그래프_탐색_개념.pdf", status: "그냥 진행 가능" }
    ],
    chatMessages: [
      {
        id: "ds-assistant-1",
        role: "assistant",
        text: "자료구조 학습을 시작했어요. 배열, 연결 리스트, 트리, 그래프처럼 비교가 필요한 개념을 질문해보세요."
      },
      {
        id: "ds-user-1",
        role: "user",
        text: "스택과 큐는 언제 다르게 쓰는지 예시로 알려줘."
      },
      {
        id: "ds-assistant-2",
        role: "assistant",
        text: "스택은 가장 최근 항목을 먼저 꺼내는 LIFO 구조이고, 큐는 먼저 들어온 항목을 먼저 처리하는 FIFO 구조입니다."
      }
    ],
    graphNodes: ["스택", "큐", "트리", "그래프", "해시 테이블"]
  },
  network: {
    title: "컴퓨터 네트워크",
    materials: [
      { id: "network-doc-1", name: "TCP_IP_핵심.pdf", status: "수준진단 대기" },
      { id: "network-doc-2", name: "라우팅과_혼잡제어.pdf", status: "그냥 진행 가능" }
    ],
    chatMessages: [
      {
        id: "network-assistant-1",
        role: "assistant",
        text: "컴퓨터 네트워크 학습을 시작했어요. TCP, HTTP, 라우팅, 혼잡 제어를 연결해서 정리할 수 있습니다."
      },
      {
        id: "network-user-1",
        role: "user",
        text: "TCP 3-way handshake 과정을 단계별로 설명해줘."
      },
      {
        id: "network-assistant-2",
        role: "assistant",
        text: "클라이언트가 SYN, 서버가 SYN-ACK, 클라이언트가 ACK를 보내며 연결을 수립합니다."
      }
    ],
    graphNodes: ["TCP", "3-way handshake", "흐름 제어", "혼잡 제어", "라우팅"]
  },
  algorithm: {
    title: "알고리즘",
    materials: [
      { id: "algo-doc-1", name: "정렬과_탐색_기초.pdf", status: "수준진단 대기" },
      { id: "algo-doc-2", name: "동적계획법_입문.pdf", status: "그냥 진행 가능" }
    ],
    chatMessages: [
      {
        id: "algo-assistant-1",
        role: "assistant",
        text: "알고리즘 학습을 시작했어요. 시간복잡도, 정렬, 그래프 탐색, DP를 단계적으로 정리해볼 수 있습니다."
      },
      {
        id: "algo-user-1",
        role: "user",
        text: "BFS와 DFS의 차이를 짧게 비교해줘."
      },
      {
        id: "algo-assistant-2",
        role: "assistant",
        text: "BFS는 가까운 정점부터 넓게 탐색하고, DFS는 한 경로를 깊게 내려간 뒤 되돌아오는 방식입니다."
      }
    ],
    graphNodes: ["시간복잡도", "정렬", "BFS", "DFS", "동적계획법"]
  }
};

export function getProjectData(projectId, workspaceState = null) {
  const normalizedId = projectId || "os";
  const persistedProject = workspaceState?.projects?.find((project) => project.id === normalizedId);
  const persistedMaterials = workspaceState?.materialsByProject?.[normalizedId];
  const project = projectCatalog[normalizedId] || {
    title: persistedProject?.title || `${normalizedId} 프로젝트`,
    materials: persistedMaterials || [],
    chatMessages: projectCatalog.os.chatMessages,
    graphNodes: projectCatalog.os.graphNodes
  };

  return {
    projectId: normalizedId,
    title: persistedProject?.title || project.title,
    materials: (persistedMaterials || project.materials).map((material) => ({ ...material })),
    chatMessages: project.chatMessages.map((message) => ({ ...message })),
    graphNodes: [...project.graphNodes]
  };
}

export function createMockMaterial(index) {
  return {
    id: `doc-${index}`,
    name: `새자료_${index}.pdf`,
    status: "수준진단 대기"
  };
}
