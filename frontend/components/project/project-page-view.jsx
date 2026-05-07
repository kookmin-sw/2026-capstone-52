"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AppShell from "../common/app-shell";
import { createMockMaterial, getProjectData } from "../../features/project/model";
import {
  getDiagnosisSummary,
  loadWorkspaceState,
  saveWorkspaceState,
  updateProjectMaterials
} from "../../features/workspace/storage";

export default function ProjectPageView({ projectId }) {
  const [projectData, setProjectData] = useState(() => getProjectData(projectId));
  const [activeTab, setActiveTab] = useState("chat");
  const [materials, setMaterials] = useState(projectData.materials);

  useEffect(() => {
    const workspaceState = loadWorkspaceState();
    const nextProjectData = getProjectData(projectId, workspaceState);
    const nextMaterials = nextProjectData.materials.map((material) => {
      const diagnosisSummary = getDiagnosisSummary(workspaceState, projectId, material.id);

      if (!diagnosisSummary) {
        return material;
      }

      return {
        ...material,
        status: diagnosisSummary.levelTitle.replace("현재 수준: ", "")
      };
    });

    setProjectData(nextProjectData);
    setMaterials(nextMaterials);
  }, [projectId]);

  function handleMockUpload() {
    if (materials.length >= 3) {
      return;
    }

    const nextIndex = materials.length + 1;

    const nextMaterials = [...materials, createMockMaterial(nextIndex)];
    const workspaceState = loadWorkspaceState();
    const nextWorkspaceState = updateProjectMaterials(workspaceState, projectData.projectId, nextMaterials);

    saveWorkspaceState(nextWorkspaceState);
    setMaterials(nextMaterials);
  }

  return (
    <AppShell
      currentSection="dashboard"
      currentPath={`/project/${projectData.projectId}`}
      title={`${projectData.title} 프롬프트`}
      subtitle="Project Workspace"
      actions={
        <div className="project-tab-group">
          <button
            type="button"
            className={`project-tab-button ${activeTab === "chat" ? "project-tab-button-active" : ""}`}
            onClick={() => setActiveTab("chat")}
          >
            채팅
          </button>
          <button
            type="button"
            className={`project-tab-button ${activeTab === "graph" ? "project-tab-button-active" : ""}`}
            onClick={() => setActiveTab("graph")}
          >
            그래프
          </button>
        </div>
      }
    >
      <div className="project-layout">
        <aside className="project-sidebar app-panel">
          <div className="app-section-heading app-section-heading-compact">
            <div>
              <p className="app-section-eyebrow">Materials</p>
              <h2>업로드 자료</h2>
            </div>
            <button
              type="button"
              className="app-button app-button-secondary"
              onClick={handleMockUpload}
              disabled={materials.length >= 3}
            >
              추가 자료 업로드
            </button>
          </div>

          <div className="project-material-list">
            {materials.map((material) => (
              <article key={material.id} className="project-material-card">
                <div>
                  <h3>{material.name}</h3>
                  <p>{material.status}</p>
                </div>
                <div className="project-material-actions">
                  <button type="button" className="app-button app-button-ghost">
                    그냥 진행
                  </button>
                  <Link
                    href={`/diagnosis?projectId=${encodeURIComponent(projectData.projectId)}&materialId=${encodeURIComponent(material.id)}`}
                    className="app-button app-button-primary"
                  >
                    수준평가
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </aside>

        <section className="project-main app-panel">
          {activeTab === "chat" ? (
            <div className="project-chat-view">
              <div className="project-chat-log">
                {projectData.chatMessages.map((message) => (
                  <article
                    key={message.id}
                    className={`project-message project-message-${message.role}`}
                  >
                    <span className="project-message-role">
                      {message.role === "assistant" ? "eeum" : "사용자"}
                    </span>
                    <p>{message.text}</p>
                  </article>
                ))}
              </div>
              <div className="project-composer">
                <textarea
                  placeholder="업로드한 PDF 전체를 기준으로 질문을 입력합니다."
                  rows={4}
                />
                <button type="button" className="app-button app-button-primary">
                  전송
                </button>
              </div>
            </div>
          ) : (
            <div className="project-graph-view">
              <div className="project-graph-canvas">
                {projectData.graphNodes.map((node, index) => (
                  <div key={node} className={`project-graph-node project-graph-node-${index + 1}`}>
                    {node}
                  </div>
                ))}
              </div>
              <div className="project-graph-tooltip">
                <strong>노드에 커서를 올리면</strong>
                <p>해당 개념과 연결된 과거 질문과 학습 흐름이 이 영역에 표시될 예정입니다.</p>
              </div>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
