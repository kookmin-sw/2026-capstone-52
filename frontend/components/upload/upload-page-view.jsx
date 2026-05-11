"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import EeumIcon from "@/components/common/EeumIcon";
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
      } catch (error) {
        console.error(error);
        if (isMounted) {
          setUploadedFiles([]);
          setRecentChats([]);
          setCanStartDiagnosis(false);
        }
      }
    }

    loadFiles();
    setPendingFiles([]);
    setIsDragging(false);
    setIsSubmitting(false);

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
    return Array.from(fileList).filter((file) => acceptedPattern.test(file.name));
  }

  function queueFiles(fileList) {
    const nextFiles = normalizeIncomingFiles(fileList);

    if (!nextFiles.length) {
      return;
    }

    setPendingFiles((current) => {
      const nextMap = new Map(current.map((file) => [file.name, file]));

      nextFiles.forEach((file) => {
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
        <aside className="workspace-upload-page-sidebar">
          <Link href="/" className="workspace-upload-brand" aria-label="eeum 홈">
            <EeumIcon className="workspace-upload-brand-icon" />
            <strong>이음</strong>
          </Link>

          <Link href="/dashboard" className="workspace-upload-create-link">
            + 새 프로젝트 생성
          </Link>

          {projectTitle ? (
            <section className="workspace-upload-sidebar-section">
              <h2>프로젝트</h2>
              <div className="workspace-upload-project-chip">
                <strong>{projectTitle}</strong>
              </div>
              <div className="workspace-upload-project-chip workspace-upload-project-chip-muted">
                <strong>자료구조</strong>
              </div>
              <div className="workspace-upload-project-chip workspace-upload-project-chip-muted">
                <strong>알고리즘</strong>
              </div>
              <div className="workspace-upload-project-chip workspace-upload-project-chip-muted">
                <strong>컴퓨터 네트워크</strong>
              </div>
            </section>
          ) : null}

          <section className="workspace-upload-sidebar-section">
            <h2>최근 채팅</h2>
            <div className="workspace-upload-recent-list">
              {sidebarChats.length ? (
                sidebarChats.map((chat) => (
                  <div key={chat.id} className="workspace-upload-recent-item">
                    <span>{chat.title}</span>
                    <em />
                  </div>
                ))
              ) : (
                <div className="workspace-empty-copy">최근 채팅이 없습니다.</div>
              )}
            </div>
          </section>

          <div className="workspace-upload-sidebar-footer">
            <Link href="/mypage" className="workspace-upload-account">
              <div className="workspace-upload-account-avatar" />
              <div>
                <strong>@lsshhhhhh</strong>
                <span>마이페이지</span>
              </div>
            </Link>
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
                  <div className="workspace-upload-dropzone-icon">↥</div>
                  <strong>파일을 드래그 앤 드롭</strong>
                  <span>또는</span>
                  <button type="button" onClick={() => fileInputRef.current?.click()}>
                    파일 선택
                  </button>
                  <small>
                    {hasPendingFiles
                      ? `${pendingFiles.length}개 파일이 업로드 대기 중입니다. 파일을 더 추가할 수도 있습니다.`
                      : "PDF 파일 · 최대 50MB"}
                  </small>
                </div>

                {hasPendingFiles ? (
                  <section className="workspace-upload-page-pending">
                    <div className="workspace-upload-page-pending-head">
                      <h2>업로드 대기 파일</h2>
                      <span>{pendingFiles.length}개 파일이 준비되었습니다.</span>
                    </div>

                    <div className="workspace-upload-files-table">
                      <div className="workspace-upload-files-head">
                        <span>파일명</span>
                        <span>프로젝트</span>
                        <span>업로드 예정</span>
                        <span>상태</span>
                      </div>

                      {pendingFiles.map((file, index) => (
                        <div key={`pending-${file.name}-${index}`} className="workspace-upload-files-row workspace-upload-files-row-pending">
                          <div className="workspace-upload-file-name">
                            <span className="workspace-upload-file-icon">📄</span>
                            <strong>{file.name}</strong>
                          </div>
                          <span>{projectTitle}</span>
                          <span>분석 전</span>
                          <span className="workspace-upload-status workspace-upload-status-idle">대기 중</span>
                        </div>
                      ))}
                    </div>

                    <p className="workspace-upload-page-pending-copy">
                      `자료 분석 시작하기`를 누르면 이 파일들이 아래 `업로드된 파일 목록`으로 이동합니다.
                    </p>
                  </section>
                ) : null}
              </div>

              <div className="workspace-upload-primary-action workspace-upload-page-primary">
                <button type="button" onClick={handleStartAnalysis} disabled={!canStartAnalysis}>
                  {isSubmitting ? "처리 중..." : "자료 분석 시작하기 →"}
                </button>
              </div>

              <section className="workspace-upload-files-panel workspace-upload-page-files" ref={fileTableRef}>
                <h2>업로드된 파일 목록</h2>
                <div className="workspace-upload-files-table">
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
                        <strong>{file.name}</strong>
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
