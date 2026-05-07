"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  buildConceptStatuses,
  buildDiagnosisAssessment,
  createDiagnosisSession,
  createEmptyAnswers,
  diagnosisStatusMap,
  isAnswerReady,
} from "../../features/diagnosis/model";
import {
  createApiDiagnosisQuestion,
  isDiagnosisBackendApiEnabled,
  submitApiDiagnosisAnswer,
} from "../../features/diagnosis/api-service";
import { getProjectData } from "../../features/project/model";
import { loadWorkspaceState, saveProjectDiagnosis, saveWorkspaceState } from "../../features/workspace/storage";

const INTRO_DELAY_MS = 1500;
const ANALYZING_DELAY_MS = 2200;
const READY_REDIRECT_DELAY_MS = 4000;
const FINAL_PROGRESS_DELAY_MS = 780;

function SparkDots() {
  return (
    <div className="diagnosis-flow-spark-dots" aria-hidden="true">
      <span />
      <span />
      <span />
    </div>
  );
}

function buildCurrentLevelBadge(conceptStatuses) {
  const understoodCount = conceptStatuses.filter((concept) => concept.tone === diagnosisStatusMap.understood.tone).length;
  const needsReviewCount = conceptStatuses.filter((concept) => concept.tone === diagnosisStatusMap.needsReview.tone).length;

  if (understoodCount >= 2 && needsReviewCount === 0) {
    return { label: "이해 빠름", tone: "positive" };
  }

  if (needsReviewCount >= 2) {
    return { label: "보강 예상", tone: "warning" };
  }

  return { label: "진단 중", tone: "neutral" };
}

export default function DiagnosisPageView({ projectId }) {
  const router = useRouter();
  const [projectData, setProjectData] = useState(() => getProjectData(projectId));
  const [step, setStep] = useState("intro");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [draftAnswer, setDraftAnswer] = useState("");
  const [assessment, setAssessment] = useState(null);
  const [apiSession, setApiSession] = useState(null);
  const [diagnosisError, setDiagnosisError] = useState(null);

  useEffect(() => {
    const workspaceState = loadWorkspaceState();
    setProjectData(getProjectData(projectId, workspaceState));
  }, [projectId]);

  const fallbackSession = useMemo(() => createDiagnosisSession(projectData), [projectData]);
  const session = apiSession || fallbackSession;

  useEffect(() => {
    if (!isDiagnosisBackendApiEnabled || !projectId) {
      setApiSession(null);
      setDiagnosisError(null);
      return undefined;
    }

    let cancelled = false;

    async function loadApiQuestion() {
      setDiagnosisError(null);

      try {
        const question = await createApiDiagnosisQuestion(projectId);

        if (cancelled) {
          return;
        }

        const choices = Array.isArray(question.choices) ? question.choices : [];
        const conceptId = question.node_id || "api-concept";

        setApiSession({
          id: `api-${question.diagnosis_id}`,
          projectId,
          projectTitle: projectData.title,
          totalQuestions: 1,
          estimatedMinutes: 1,
          concepts: [
            {
              id: conceptId,
              label: "진단 대상 개념",
            },
          ],
          questions: [
            {
              id: question.diagnosis_id,
              diagnosisId: question.diagnosis_id,
              type: "multiple-choice",
              conceptIds: [conceptId],
              prompt: question.question,
              choices: choices.map((choice, index) => ({
                id: String(index),
                label: choice,
              })),
              order: 1,
            },
          ],
        });
      } catch (error) {
        if (!cancelled) {
          setDiagnosisError(error instanceof Error ? error.message : "진단 질문을 불러오지 못했습니다.");
          setApiSession(null);
        }
      }
    }

    loadApiQuestion();

    return () => {
      cancelled = true;
    };
  }, [projectData.title, projectId]);

  useEffect(() => {
    setAnswers(createEmptyAnswers(session));
    setDraftAnswer("");
    setAssessment(null);
    setQuestionIndex(0);
    setStep("intro");
  }, [session]);

  useEffect(() => {
    if (step !== "intro") {
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      setStep("quiz");
    }, INTRO_DELAY_MS);

    return () => window.clearTimeout(timeout);
  }, [step]);

  useEffect(() => {
    if (step !== "analyzing") {
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      const nextAssessment = buildDiagnosisAssessment(session, answers);
      const workspaceState = loadWorkspaceState();
      const nextWorkspaceState = saveProjectDiagnosis(workspaceState, projectId, {
        savedAt: Date.now(),
        sessionId: session.id,
        totalQuestionCount: session.totalQuestions,
        completedQuestionCount: session.totalQuestions,
        answers,
        questions: session.questions,
        conceptStatuses: nextAssessment.conceptStatuses,
        assessment: nextAssessment,
      });

      saveWorkspaceState(nextWorkspaceState);
      setAssessment(nextAssessment);
      setStep("ready");
    }, ANALYZING_DELAY_MS);

    return () => window.clearTimeout(timeout);
  }, [answers, projectId, session, step]);

  useEffect(() => {
    if (step !== "ready") {
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      router.push(`/dashboard?projectId=${encodeURIComponent(projectId)}`);
    }, READY_REDIRECT_DELAY_MS);

    return () => window.clearTimeout(timeout);
  }, [projectId, router, step]);

  const currentQuestion = session.questions[questionIndex] || null;
  const currentAnswer = draftAnswer;
  const isCurrentAnswerReady = currentQuestion ? isAnswerReady(currentQuestion, draftAnswer) : false;
  const conceptStatuses = useMemo(
    () => buildConceptStatuses(session, answers, questionIndex, step === "ready"),
    [answers, questionIndex, session, step]
  );
  const currentLevelBadge = buildCurrentLevelBadge(conceptStatuses);
  const answeredCount = Object.values(answers).filter((answer) => typeof answer === "string" && answer.trim()).length;
  const progressRatio = session.totalQuestions ? answeredCount / session.totalQuestions : 0;

  function updateCurrentAnswer(value) {
    if (!currentQuestion) {
      return;
    }

    setDraftAnswer(value);
  }

  async function handleAdvance(nextAnswer = null) {
    if (!currentQuestion) {
      return;
    }

    const resolvedAnswer = typeof nextAnswer === "string" ? nextAnswer : draftAnswer;

    if (!isAnswerReady(currentQuestion, resolvedAnswer)) {
      return;
    }

    const nextAnswers = {
      ...answers,
      [currentQuestion.id]: resolvedAnswer,
    };

    setAnswers(nextAnswers);
    setDraftAnswer("");

    if (isDiagnosisBackendApiEnabled && currentQuestion.diagnosisId) {
      const selectedIndex = currentQuestion.type === "multiple-choice"
        ? currentQuestion.choices.findIndex((choice) => choice.id === resolvedAnswer)
        : 0;

      setStep("analyzing");

      try {
        const result = await submitApiDiagnosisAnswer(projectId, currentQuestion.diagnosisId, Math.max(selectedIndex, 0));
        const nextStatus = result.is_correct ? diagnosisStatusMap.understood : diagnosisStatusMap.needsReview;
        const conceptStatuses = session.concepts.map((concept) => ({
          ...concept,
          status: nextStatus.label,
          tone: nextStatus.tone,
        }));
        const nextAssessment = {
          levelTitle: result.is_correct ? "현재 수준: 핵심 개념 이해" : "현재 수준: 개념 기초부터 보강 필요",
          summary: result.is_correct
            ? `${session.projectTitle} 기준 진단 질문에 정답 처리되었습니다.`
            : `${session.projectTitle} 기준 추가 학습이 필요한 개념이 확인되었습니다.`,
          missingConcepts: result.is_correct ? [] : conceptStatuses.map((concept) => concept.label),
          roadmap: result.is_correct
            ? ["응용 질문으로 개념 연결 확장"]
            : ["오답 개념 다시 정리", "예시 기반 설명으로 보강"],
          conceptStatuses,
        };
        const workspaceState = loadWorkspaceState();
        const nextWorkspaceState = saveProjectDiagnosis(workspaceState, projectId, {
          savedAt: Date.now(),
          sessionId: session.id,
          totalQuestionCount: session.totalQuestions,
          completedQuestionCount: session.totalQuestions,
          answers: nextAnswers,
          questions: session.questions,
          conceptStatuses,
          assessment: nextAssessment,
        });

        saveWorkspaceState(nextWorkspaceState);
        setAssessment(nextAssessment);
        setStep("ready");
      } catch (error) {
        setDiagnosisError(error instanceof Error ? error.message : "진단 답변을 제출하지 못했습니다.");
        setStep("quiz");
      }

      return;
    }

    if (questionIndex >= session.totalQuestions - 1) {
      window.setTimeout(() => {
        setStep("analyzing");
      }, FINAL_PROGRESS_DELAY_MS);
      return;
    }

    setQuestionIndex((current) => current + 1);
  }

  return (
    <main className="diagnosis-flow-shell">
      <div className="diagnosis-flow-orb diagnosis-flow-orb-left" aria-hidden="true" />
      <div className="diagnosis-flow-orb diagnosis-flow-orb-right" aria-hidden="true" />
      <div className="diagnosis-flow-stars" aria-hidden="true" />

      {step === "intro" ? (
        <section className="diagnosis-flow-centered">
          <div className="diagnosis-flow-copy">
            <h1>이음이 나를 알아가는 시간이에요</h1>
            <p>물음에 편하게 답해주세요</p>
          </div>
        </section>
      ) : null}

      {step === "quiz" && currentQuestion ? (
        <section className="diagnosis-flow-quiz">
          <header className="diagnosis-flow-quiz-head">
            <span>
              {currentQuestion.order} / {session.totalQuestions}
            </span>
            <strong>나를 파악하는 중이에요</strong>
          </header>

          <div className="diagnosis-flow-progress-hero">
            <div className="diagnosis-flow-radar" aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
            </div>
            <p>질문에 답해주세요</p>
          </div>

          <div className="diagnosis-flow-step-track" aria-hidden="true">
            <div className="diagnosis-flow-step-fill" style={{ width: `${progressRatio * 100}%` }} />
            <div className="diagnosis-flow-step-nodes">
              {Array.from({ length: session.totalQuestions + 1 }).map((_, index) => (
                <span
                  key={`progress-${index}`}
                  className={`diagnosis-flow-step-dot ${
                    index <= answeredCount ? "diagnosis-flow-step-dot-complete" : ""
                  } ${index === answeredCount ? "diagnosis-flow-step-dot-current" : ""}`}
                />
              ))}
            </div>
          </div>

          <div className="diagnosis-flow-panels">
            <aside className="diagnosis-flow-sidecard">
              <h2>진단 현황</h2>

              <div className="diagnosis-flow-sideblock">
                <span>진행률</span>
                <strong>
                  {currentQuestion.order} / {session.totalQuestions} 문항
                </strong>
                <div className="diagnosis-flow-progress-bar">
                  <div style={{ width: `${progressRatio * 100}%` }} />
                </div>
              </div>

              <div className="diagnosis-flow-sideblock">
                <span>예상 남은 시간</span>
                <strong>약 {Math.max(1, session.estimatedMinutes - Math.floor(questionIndex / 2))}분</strong>
              </div>

              <div className="diagnosis-flow-sideblock">
                <span>현재 추정 수준</span>
                <div className={`diagnosis-flow-level-badge diagnosis-flow-level-badge-${currentLevelBadge.tone}`}>
                  {currentLevelBadge.label}
                </div>
              </div>
            </aside>

            <div className="diagnosis-flow-center-column">
              <section className="diagnosis-flow-question-card">
                <div className="diagnosis-flow-question-subject">
                  <span>{projectData.title}</span>
                </div>

                <h2>{currentQuestion.prompt}</h2>
                {diagnosisError ? <p className="workspace-empty-copy">{diagnosisError}</p> : null}

                {currentQuestion.type === "multiple-choice" ? (
                  <div className="diagnosis-flow-choice-list">
                    {currentQuestion.choices.map((choice, index) => (
                      <button
                        key={choice.id}
                        type="button"
                        className={`diagnosis-flow-choice ${
                          currentAnswer === choice.id ? "diagnosis-flow-choice-active" : ""
                        }`}
                        onClick={() => updateCurrentAnswer(choice.id)}
                      >
                        <span className="diagnosis-flow-choice-index">{String.fromCharCode(65 + index)}</span>
                        <span>{choice.label}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="diagnosis-flow-answer-wrap">
                    <textarea
                      rows={6}
                      value={currentAnswer}
                      onChange={(event) => updateCurrentAnswer(event.target.value)}
                      placeholder={currentQuestion.placeholder}
                    />
                  </div>
                )}
              </section>

              <div className="diagnosis-flow-actions">
                <button
                  type="button"
                  className="diagnosis-flow-action diagnosis-flow-action-secondary"
                  onClick={() =>
                    handleAdvance(currentQuestion.type === "short-answer" ? "잘 모르겠어요." : "unknown")
                  }
                >
                  잘 모르겠어요
                </button>
                <button
                  type="button"
                  className="diagnosis-flow-action diagnosis-flow-action-primary"
                  onClick={() => handleAdvance()}
                  disabled={!isCurrentAnswerReady}
                >
                  {questionIndex >= session.totalQuestions - 1 ? "분석 시작하기 →" : "다음 질문 →"}
                </button>
              </div>
            </div>

            <aside className="diagnosis-flow-sidecard">
              <h2>진단 개념 목록</h2>
              <div className="diagnosis-flow-concept-list">
                {conceptStatuses.map((concept) => (
                  <article
                    key={concept.id}
                    className={`diagnosis-flow-concept-item diagnosis-flow-concept-item-${concept.tone}`}
                  >
                    <div className="diagnosis-flow-concept-name">
                      <span className="diagnosis-flow-concept-dot" />
                      <strong>{concept.label}</strong>
                    </div>
                    <span className="diagnosis-flow-concept-status">{concept.status}</span>
                  </article>
                ))}
              </div>
            </aside>
          </div>
        </section>
      ) : null}

      {step === "analyzing" ? (
        <section className="diagnosis-flow-centered">
          <div className="diagnosis-flow-copy diagnosis-flow-copy-wide">
            <h1>이음이 분석하고 있어요</h1>
            <p>나에게 맞는 학습 설정을 준비하는 중이에요</p>
            <SparkDots />
          </div>
        </section>
      ) : null}

      {step === "ready" ? (
        <section className="diagnosis-flow-centered">
          <div className="diagnosis-flow-copy diagnosis-flow-copy-wide">
            <h1>준비됐어요!</h1>
            <p>이제 대화할 때마다 딱 맞는 설명을 드릴게요</p>
            {assessment ? (
              <small>
                {answeredCount}개 응답을 바탕으로 <strong>{assessment.levelTitle.replace("현재 수준: ", "")}</strong>{" "}
                상태로 반영했습니다.
              </small>
            ) : null}
          </div>
        </section>
      ) : null}
    </main>
  );
}
