export const projectCatalog = {
  calculus: {
    title: "미적분 복습 프로젝트",
    materials: [
      { id: "doc-1", name: "미적분_1장_정리.pdf", status: "수준진단 대기" },
      { id: "doc-2", name: "접선과_미분계수.pdf", status: "그냥 진행 가능" },
      { id: "doc-3", name: "연습문제_풀이.pdf", status: "진단 완료" }
    ],
    chatMessages: [
      {
        id: "assistant-1",
        role: "assistant",
        text: "업로드한 PDF를 바탕으로 질문할 수 있습니다. 아직 대화가 많지 않다면, 먼저 궁금한 개념이나 목표를 짧게 적어보세요."
      },
      {
        id: "user-1",
        role: "user",
        text: "접선의 방정식이 왜 기울기와 연결되는지 설명해줘."
      },
      {
        id: "assistant-2",
        role: "assistant",
        text: "접선은 특정 점에서 곡선의 변화를 가장 잘 대표하는 직선입니다. 그래서 그 점에서의 순간 변화율이 곧 접선의 기울기가 됩니다."
      }
    ],
    graphNodes: ["기울기", "변화율", "미분계수", "접선", "직선의 방정식"]
  }
};

export function getProjectData(projectId, workspaceState = null) {
  const normalizedId = projectId || "calculus";
  const persistedProject = workspaceState?.projects?.find((project) => project.id === normalizedId);
  const persistedMaterials = workspaceState?.materialsByProject?.[normalizedId];
  const project = projectCatalog[normalizedId] || {
    title: persistedProject?.title || `${normalizedId} 프로젝트`,
    materials: persistedMaterials || [],
    chatMessages: projectCatalog.calculus.chatMessages,
    graphNodes: projectCatalog.calculus.graphNodes
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
