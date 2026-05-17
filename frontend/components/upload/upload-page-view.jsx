"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import EeumIcon from "@/components/common/EeumIcon";
import WorkspaceProfileCard from "@/components/dashboard/WorkspaceProfileCard";
import { getProjectChats, getProjects } from "../../features/dashboard/service";
import { getProjectData } from "../../features/project/model";
import {
  hasCompletedAnalysis,
  isBackendApiEnabled,
  listProjectFiles,
  refreshAnalysisStatuses,
  startAnalysis,
  uploadProjectFiles,
} from "../../features/upload/service";
import { createLearningLog } from "../../features/learning-log/service";
import { loadWorkspaceState } from "../../features/workspace/storage";

const uploadProjectDotColors = ["#817cf2", "#2bbf8a", "#f29f45", "#e36b7f", "#3a9eea", "#b36bea"];
const uploadSidebarProjectFallbacks = ["자료구조", "알고리즘", "컴퓨터 네트워크"];

function formatUploadSidebarDate(isoString) {
  const date = new Date(isoString);

  if (Number.isNaN(date.getTime())) {
    return "최근";
  }

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffMinutes < 1) {
    return "방금 전";
  }

  if (diffMinutes < 60) {
    return `${diffMinutes}분 전`;
  }

  const diffHours = Math.floor(diffMinutes / 60);

  if (diffHours < 24) {
    return `${diffHours}시간 전`;
  }

  const diffDays = Math.floor(diffHours / 24);

  if (diffDays < 7) {
    return `${diffDays}일 전`;
  }

  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
  }).format(date);
}

export default function UploadPageView({ initialProjectId = null }) {
  const router = useRouter();
  const fileInputRef = useRef(null);
  const fileTableRef = useRef(null);
  const loggedGraphUpdateFileIdsRef = useRef(new Set());
  const [projectId, setProjectId] = useState(initialProjectId);
  const [projectTitle, setProjectTitle] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [recentChats, setRecentChats] = useState([]);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProjectResolved, setIsProjectResolved] = useState(false);
  const [canStartDiagnosis, setCanStartDiagnosis] = useState(false);
  const [uploadFeedback, setUploadFeedback] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function hydrateProject() {
      const projects = await getProjects();

      if (!isMounted) {
        return;
      }

      const resolvedProjectId =
        (initialProjectId && projects.some((project) => project.id === initialProjectId) && initialProjectId) ||
        projects[0]?.id ||
        null;

      setProjectId(resolvedProjectId);

      if (!resolvedProjectId) {
        setProjectTitle("");
        setIsProjectResolved(true);
        return;
      }

      const project = projects.find((item) => item.id === resolvedProjectId);
      const projectData = getProjectData(resolvedProjectId, loadWorkspaceState());
      setProjectTitle(project?.title || projectData.title);
      setIsProjectResolved(true);
    }

    hydrateProject();

    return () => {
      isMounted = false;
    };
  }, [initialProjectId]);

  useEffect(() => {
    if (!projectId) {
      setUploadedFiles([]);
      setRecentChats([]);
      setPendingFiles([]);
      setIsDragging(false);
      setIsSubmitting(false);
      setCanStartDiagnosis(false);
      setUploadFeedback(null);
      return;
    }

    let isMounted = true;

    async function loadFiles() {
      try {
        const files = await listProjectFiles(projectId);
        const hasCompleted = await hasCompletedAnalysis(projectId);
        const chats = await getProjectChats(projectId);

        if (!isMounted) {
          return;
        }

        setUploadedFiles(files);
        setRecentChats(chats);
        setCanStartDiagnosis(hasCompleted);
        setUploadFeedback(null);
      } catch (error) {
        console.error(error);
        if (isMounted) {
          setUploadedFiles([]);
          setRecentChats([]);
          setCanStartDiagnosis(false);
          setUploadFeedback("업로드된 파일 목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
        }
      }
    }

    loadFiles();
    setPendingFiles([]);
    setIsDragging(false);
    setIsSubmitting(false);
    setUploadFeedback(null);

    return () => {
      isMounted = false;
    };
  }, [projectId]);

  useEffect(() => {
    if (!projectId) {
      return undefined;
    }

    const hasRunningAnalysis = uploadedFiles.some((file) => file.statusTone === "working");

    if (!hasRunningAnalysis) {
      return undefined;
    }

    const timer = window.setInterval(async () => {
      try {
        const files = await refreshAnalysisStatuses(projectId, uploadedFiles);
        const completedFiles = files.filter((file) => file.rawStatus === "DONE" || file.statusTone === "done");
        const newlyCompletedFiles = completedFiles.filter((file) => !loggedGraphUpdateFileIdsRef.current.has(file.id));

        if (newlyCompletedFiles.length) {
          newlyCompletedFiles.forEach((file) => loggedGraphUpdateFileIdsRef.current.add(file.id));
          createLearningLog({
            projectId,
            activityType: "graph_updated",
            activitySummary: `${newlyCompletedFiles.length}개 자료 분석 결과가 지식 그래프에 반영되었습니다.`,
          }).catch(console.error);
        }

        setUploadedFiles(files);
        setCanStartDiagnosis(completedFiles.length > 0);
      } catch (error) {
        console.error(error);
      }
    }, 1200);

    return () => window.clearInterval(timer);
  }, [projectId, uploadedFiles]);

  const sidebarChats = useMemo(() => recentChats.slice(0, 6), [recentChats]);
  const sidebarProjects = useMemo(() => {
    const projectNames = [projectTitle, ...uploadSidebarProjectFallbacks].filter(Boolean);
    return [...new Set(projectNames)].slice(0, 4);
  }, [projectTitle]);
  const hasPendingFiles = pendingFiles.length > 0;
  const canStartAnalysis = Boolean(projectId) && pendingFiles.length > 0 && !isSubmitting;
  const dashboardHref = projectId
    ? `/dashboard?projectId=${encodeURIComponent(projectId)}`
    : "/dashboard";
  const diagnosisHref = projectId
    ? `/diagnosis?projectId=${encodeURIComponent(projectId)}`
    : "/diagnosis";

  function normalizeIncomingFiles(fileList) {
    const acceptedPattern = isBackendApiEnabled ? /\.pdf$/i : /\.(pdf|txt)$/i;
    const files = Array.from(fileList);
    const acceptedFiles = files.filter((file) => acceptedPattern.test(file.name));

    return {
      acceptedFiles,
      rejectedCount: files.length - acceptedFiles.length,
    };
  }

  function queueFiles(fileList) {
    const { acceptedFiles, rejectedCount } = normalizeIncomingFiles(fileList);

    if (rejectedCount > 0) {
      const supportedTypes = isBackendApiEnabled ? "PDF" : "PDF 또는 TXT";
      setUploadFeedback(`${supportedTypes} 파일만 업로드할 수 있어 ${rejectedCount}개 파일을 제외했습니다.`);
    } else {
      setUploadFeedback(null);
    }

    if (!acceptedFiles.length) {
      return;
    }

    setPendingFiles((current) => {
      const nextMap = new Map(current.map((file) => [file.name, file]));

      acceptedFiles.forEach((file) => {
        nextMap.set(file.name, file);
      });

      return [...nextMap.values()];
    });
  }

  function handleFileInputChange(event) {
    queueFiles(event.target.files || []);
    event.target.value = "";
  }

  function handleDrop(event) {
    event.preventDefault();
    setIsDragging(false);
    queueFiles(event.dataTransfer.files || []);
  }

  async function handleStartAnalysis() {
    if (!projectId || !pendingFiles.length || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setUploadFeedback(null);

    try {
      const uploaded = await uploadProjectFiles(projectId, projectTitle || "새 프로젝트", pendingFiles);
      if (uploaded.length) {
        createLearningLog({
          projectId,
          activityType: "file_uploaded",
          activitySummary: `${uploaded.length}개 학습 자료를 업로드했습니다.`,
        }).catch(console.error);
      }
      const nextFiles = await startAnalysis(
        projectId,
        uploaded.map((file) => file.id)
      );
      const hasCompleted = await hasCompletedAnalysis(projectId);

      setUploadedFiles(nextFiles);
      setPendingFiles([]);
      setCanStartDiagnosis(hasCompleted);

      window.setTimeout(() => {
        fileTableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 120);
    } catch (error) {
      console.error(error);
      setUploadFeedback(error instanceof Error ? error.message : "업로드 또는 분석을 시작하지 못했습니다. 다시 시도해주세요.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="workspace-upload-page">
      <header className="workspace-upload-page-header">
        <div className="workspace-upload-page-header-copy">
          <Link href={dashboardHref} className="workspace-upload-dashboard-link workspace-upload-page-back">
            ← 돌아가기
          </Link>
          <div className="workspace-upload-page-title">
            <h1>자료 업로드</h1>
          </div>
        </div>
      </header>

      <div className="workspace-upload-page-body">
        <aside className="workspace-upload-page-sidebar workspace-sidebar">
          <div className="workspace-sidebar-top">
            <Link href="/" className="workspace-upload-brand workspace-brand-link" aria-label="eeum 홈">
              <EeumIcon className="workspace-upload-brand-icon" />
              <strong>이음</strong>
            </Link>

            <Link href="/dashboard" className="workspace-upload-create-link workspace-create-button">
              + 새 프로젝트 생성
            </Link>
          </div>

          <div className="workspace-sidebar-main">
            {sidebarProjects.length ? (
              <section className="workspace-sidebar-group workspace-project-selector">
                <div className="workspace-sidebar-heading">
                  <span>프로젝트</span>
                </div>
                <div className="workspace-sidebar-section-scroll workspace-project-list">
                  {sidebarProjects.map((title, index) => {
                    const isActive = title === projectTitle;
                    const dotColor = uploadProjectDotColors[index % uploadProjectDotColors.length];

                    return (
                      <Link
                        key={`${title}-${index}`}
                        href={isActive ? dashboardHref : "/dashboard"}
                        className={`workspace-project-item ${isActive ? "workspace-project-item-active" : ""}`}
                        style={{ "--workspace-project-dot-color": dotColor }}
                      >
                        <em />
                        <span className="workspace-project-item-copy">
                          <strong>{title}</strong>
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </section>
            ) : null}

            <section className="workspace-sidebar-group workspace-sidebar-group-fill">
              <div className="workspace-sidebar-heading">
                <span>최근 채팅</span>
              </div>
              <div className="workspace-sidebar-section-scroll workspace-chat-shortcuts">
                {sidebarChats.length ? (
                  sidebarChats.map((chat, index) => {
                    const chatHref = projectId
                      ? `/dashboard?projectId=${encodeURIComponent(projectId)}&chatId=${encodeURIComponent(chat.id)}`
                      : "/dashboard";

                    return (
                      <Link
                        key={chat.id}
                        href={chatHref}
                        className={`workspace-chat-shortcut ${index === 0 ? "workspace-chat-shortcut-active" : ""}`}
                      >
                        <span className="workspace-chat-shortcut-title">{chat.title}</span>
                        <small className="workspace-chat-shortcut-meta">{formatUploadSidebarDate(chat.updatedAt)}</small>
                      </Link>
                    );
                  })
                ) : (
                  <div className="workspace-empty-copy">최근 채팅이 없습니다.</div>
                )}
              </div>
            </section>
          </div>

          <div className="workspace-sidebar-footer workspace-upload-sidebar-footer">
            <WorkspaceProfileCard />
          </div>
        </aside>

        <main className="workspace-upload-page-main">
          {!projectId && isProjectResolved ? (
            <section className="workspace-upload-page-empty">
              <h1>프로젝트가 없습니다.</h1>
              <p>대시보드에서 프로젝트를 만든 뒤 자료 업로드를 진행해주세요.</p>
              <Link href="/dashboard" className="workspace-upload-page-empty-link">
                대시보드로 돌아가기
              </Link>
            </section>
          ) : (
            <section className="workspace-upload-page-main-inner">
              <div className="workspace-upload-page-intro">
                <h1>자료 업로드</h1>
                <p>학습 자료를 업로드하면 AI가 분석하여 나에게 맞는 학습을 시작합니다.</p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.txt"
                multiple
                className="workspace-upload-file-input"
                onChange={handleFileInputChange}
              />

              <div className="workspace-upload-page-dropzone-wrap">
                <div
                  className={`workspace-upload-dropzone ${isDragging ? "workspace-upload-dropzone-dragging" : ""}`}
                  onDragEnter={(event) => {
                    event.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={(event) => {
                    event.preventDefault();
                    setIsDragging(false);
                  }}
                  onDrop={handleDrop}
                >
                  <div className="workspace-upload-dropzone-icon" aria-hidden="true">
                    <img className="workspace-upload-dropzone-symbol" src="/icons/upload/upload.svg" alt="" />
                  </div>
                  <strong>파일을 드래그 앤 드롭</strong>
                  <span>또는</span>
                  <button type="button" onClick={() => fileInputRef.current?.click()}>
                    파일 선택
                  </button>
                  {hasPendingFiles ? (
                    <small>{pendingFiles.length}개 파일이 업로드 대기 중입니다. 파일을 더 추가할 수도 있습니다.</small>
                  ) : null}
                </div>

                {uploadFeedback ? <p className="workspace-upload-feedback">{uploadFeedback}</p> : null}
              </div>

              <section className="workspace-upload-files-panel workspace-upload-page-files" ref={fileTableRef}>
                <div className="workspace-upload-files-panel-header">
                  <h2>업로드된 파일 목록</h2>
                  <div className="workspace-upload-primary-action workspace-upload-files-panel-action">
                    <button type="button" onClick={handleStartAnalysis} disabled={!canStartAnalysis}>
                      {isSubmitting ? "처리 중..." : "자료 분석하기 →"}
                    </button>
                  </div>
                </div>
                <div className="workspace-upload-files-table workspace-upload-files-table-uploaded">
                  <div className="workspace-upload-files-head">
                    <span>파일명</span>
                    <span>프로젝트</span>
                    <span>업로드 시간</span>
                    <span>상태</span>
                  </div>

                  {uploadedFiles.map((file) => (
                    <div key={file.id} className="workspace-upload-files-row">
                      <div className="workspace-upload-file-name">
                        <span className="workspace-upload-file-icon">📄</span>
                        <span className="workspace-upload-file-title">{file.name}</span>
                      </div>
                      <span>{file.subject}</span>
                      <span>{file.uploadedAt}</span>
                      <span className={`workspace-upload-status workspace-upload-status-${file.statusTone}`}>{file.status}</span>
                    </div>
                  ))}
                </div>
              </section>

              <div className="workspace-upload-secondary-action workspace-upload-page-secondary">
                <button
                  type="button"
                  disabled={!canStartDiagnosis}
                  onClick={() => {
                    if (!canStartDiagnosis) {
                      return;
                    }

                    router.push(diagnosisHref);
                  }}
                >
                  학습 상태 체크하기 →
                </button>
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
