export const projectCatalog = {
  os: {
    title: "운영체제",
    materials: [
      { id: "os-doc-1", name: "프로세스와_스레드.pdf", status: "수준진단 대기" },
      { id: "os-doc-2", name: "CPU_스케줄링_정리.pdf", status: "그냥 진행 가능" }
    ],
    chatMessages: [],
    graphNodes: ["프로세스", "스레드", "CPU 스케줄링", "가상 메모리", "파일 시스템"]
  },
  "data-structures": {
    title: "자료구조",
    materials: [
      { id: "ds-doc-1", name: "스택_큐_트리_요약.pdf", status: "수준진단 대기" },
      { id: "ds-doc-2", name: "그래프_탐색_개념.pdf", status: "그냥 진행 가능" }
    ],
    chatMessages: [],
    graphNodes: ["스택", "큐", "트리", "그래프", "해시 테이블"]
  },
  network: {
    title: "컴퓨터 네트워크",
    materials: [
      { id: "network-doc-1", name: "TCP_IP_핵심.pdf", status: "수준진단 대기" },
      { id: "network-doc-2", name: "라우팅과_혼잡제어.pdf", status: "그냥 진행 가능" }
    ],
    chatMessages: [],
    graphNodes: ["TCP", "3-way handshake", "흐름 제어", "혼잡 제어", "라우팅"]
  },
  algorithm: {
    title: "알고리즘",
    materials: [
      { id: "algo-doc-1", name: "정렬과_탐색_기초.pdf", status: "수준진단 대기" },
      { id: "algo-doc-2", name: "동적계획법_입문.pdf", status: "그냥 진행 가능" }
    ],
    chatMessages: [],
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
