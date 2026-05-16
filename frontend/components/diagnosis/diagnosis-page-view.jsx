"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import EeumIcon from "@/components/common/EeumIcon";
import {
  buildApiDiagnosisConcepts,
  buildConceptStatuses,
  buildDiagnosisAssessment,
  createDiagnosisSession,
  createEmptyAnswers,
  diagnosisStatusMap,
  isAnswerReady,
  normalizeDiagnosisQuestion,
} from "../../features/diagnosis/model";
import {
  createApiDiagnosisSession,
  createApiDiagnosisQuestion,
  createApiDiagnosisReport,
  getApiProjectGraph,
  getApiDiagnosisStatus,
  isDiagnosisBackendApiEnabled,
  submitApiDiagnosisAnswer,
} from "../../features/diagnosis/api-service";
import { createDiagnosisReportChat } from "../../features/dashboard/service";
import { createLearningLog } from "../../features/learning-log/service";
import { getProjectData } from "../../features/project/model";
import {
  loadWorkspaceState,
  saveProjectDiagnosis,
  saveWorkspaceState,
  setLastOpenedProject,
} from "../../features/workspace/storage";

const ANALYZING_DELAY_MS = 2200;
const FINAL_PROGRESS_DELAY_MS = 420;
const DIAGNOSIS_REMAINING_UNITS = 12;
const DIAGNOSIS_SECONDS_PER_UNIT = 30;
const EEUM_SPARKLE_PATH =
  "M 0 -38 C 3 -12 12 -3 38 0 C 12 3 3 12 0 38 C -3 12 -12 3 -38 0 C -12 -3 -3 -12 0 -38 Z";

function SparkDots() {
  return (
    <div className="diagnosis-flow-spark-dots" aria-hidden="true">
      <span />
      <span />
      <span />
    </div>
  );
}

function AnalysisLoadingMark() {
  return (
    <div className="diagnosis-flow-analysis-mark" aria-hidden="true">
      <svg className="diagnosis-flow-analysis-orbit" viewBox="0 0 120 120">
        <circle className="diagnosis-flow-analysis-orbit-track" cx="60" cy="60" r="54" />
        <circle className="diagnosis-flow-analysis-orbit-bar" cx="60" cy="60" r="54" />
      </svg>
      <div className="diagnosis-flow-analysis-core">
        <svg className="diagnosis-flow-analysis-stars" viewBox="0 0 200 200">
          <g transform="translate(90 86)">
            <path className="diagnosis-flow-analysis-star diagnosis-flow-analysis-star-big" d={EEUM_SPARKLE_PATH} />
          </g>
          <g transform="translate(128 120)">
            <path className="diagnosis-flow-analysis-star diagnosis-flow-analysis-star-small" d={EEUM_SPARKLE_PATH} />
          </g>
        </svg>
      </div>
    </div>
  );
}

function EeumMark() {
  return (
    <div className="diagnosis-flow-eeum-mark">
      <EeumIcon className="diagnosis-flow-eeum-icon" />
    </div>
  );
}

function CelebrationMark() {
  return (
    <div className="diagnosis-flow-celebration-mark" aria-hidden="true">
      🎉
    </div>
  );
}

function renderQuestionPrompt(prompt) {
  if (!prompt) {
    return null;
  }

  const parts = prompt.split(/('.*?')/g).filter(Boolean);

  return parts.map((part, index) => {
    if (part.startsWith("'") && part.endsWith("'")) {
      return (
        <span key={`${part}-${index}`} className="diagnosis-flow-question-highlight">
          {part.slice(1, -1)}
        </span>
      );
    }

    return <span key={`${part}-${index}`}>{part}</span>;
  });
}

function getConceptStatusText(concept) {
  if (concept.tone === diagnosisStatusMap.understood.tone) {
    return "✓ 이해";
  }
  if (concept.tone === diagnosisStatusMap.needsReview.tone) {
    return "✓ 추가 학습";
  }
  if (concept.tone === diagnosisStatusMap.inProgress.tone) {
    return "● 진행 중";
  }
  return concept.status || "미진단";
}

function createEmptyDraftAnswer(question) {
  return question?.type === "multiple-choice" ? [] : "";
}

function getSelectedChoiceIds(answer) {
  if (Array.isArray(answer)) {
    return answer.filter(Boolean).map((choiceId) => String(choiceId));
  }

  return answer ? [String(answer)] : [];
}

function normalizeApiChoice(choice, index) {
  // 백엔드 diagnosis 응답에 option_id 가 없는 케이스 대비 — 인덱스 기반으로 A/B/C/... 자동 부여.
  // 백엔드 submit 은 selected_option_ids: ["A","C"] 형태를 기대하므로 항상 string id 가 채워져야 함.
  const fallbackOptionId = String.fromCharCode(65 + index);
  if (choice && typeof choice === "object") {
    const optionId = choice.option_id ?? choice.optionId ?? fallbackOptionId;
    const id = String(choice.id ?? optionId ?? choice.choice_id ?? choice.value ?? index);
    return {
      ...choice,
      id,
      optionId: String(optionId),
      label: choice.label || choice.text || choice.name || choice.title || String(choice.value ?? index),
    };
  }

  return {
    id: String(index),
    optionId: fallbackOptionId,
    label: String(choice),
  };
}

function formatRemainingTime(solvedQuestionCount) {
  const remainingSeconds = Math.max(0, DIAGNOSIS_REMAINING_UNITS - solvedQuestionCount) * DIAGNOSIS_SECONDS_PER_UNIT;
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;

  return `${minutes}분 ${seconds}초`;
}

export default function DiagnosisPageView({ projectId }) {
  const router = useRouter();
  const [projectData, setProjectData] = useState(() => getProjectData(projectId));
  const [step, setStep] = useState("intro");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [draftAnswer, setDraftAnswer] = useState("");
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
        const diagnosisSession = await createApiDiagnosisSession(projectId);
        const sessionId = diagnosisSession?.session_id;

        if (!sessionId) {
          throw new Error("진단 세션을 생성하지 못했습니다.");
        }

        const [question, status, graphData] = await Promise.all([
          createApiDiagnosisQuestion(projectId, sessionId),
          getApiDiagnosisStatus(projectId, sessionId).catch(() => null),
          getApiProjectGraph(projectId).catch(() => null),
        ]);

        if (cancelled) {
          return;
        }

        const choices = Array.isArray(question.choices) ? question.choices : [];
        const graphNodes = Array.isArray(graphData?.nodes) ? graphData.nodes : [];
        const apiQuestion = {
          ...question,
          node_id: question.concept_id || question.node_id,
        };
        const concepts = buildApiDiagnosisConcepts(projectData, graphNodes, apiQuestion);
        const fallbackConceptId = question.concept_id || question.node_id || "api-concept";
        const normalizedQuestion = normalizeDiagnosisQuestion({
          id: question.question_id,
          diagnosisId: question.question_id,
          type: "multiple-choice",
          questionType: question.question_type || null,
          isMultiSelect: question.question_type === "multi_select",
          node_id: question.concept_id || question.node_id,
          node_name: question.node_name || question.concept_name || "진단 대상 개념",
          conceptIds: question.conceptIds ||
            question.concept_ids ||
            [
              {
                node_id: fallbackConceptId,
                name: question.node_name || question.concept_name || "진단 대상 개념",
              },
            ],
          prompt: question.question,
          choices: choices.map(normalizeApiChoice),
          difficulty:
            question.difficulty ??
            question.difficulty_level ??
            question.difficultyValue ??
            question.level,
          order: 1,
        });

        setApiSession({
          id: sessionId,
          projectId,
          projectTitle: projectData.title,
          totalQuestions: 1,
          estimatedMinutes: 6,
          concepts: concepts.length
            ? concepts
            : [
                {
                  id: fallbackConceptId,
                  label: question.node_name || question.concept_name || "진단 대상 개념",
                },
              ],
          questions: [normalizedQuestion],
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
    setDraftAnswer(createEmptyDraftAnswer(session.questions[0]));
    setQuestionIndex(0);
    setStep("intro");
  }, [session]);

  useEffect(() => {
    if (step !== "analyzing") {
      return undefined;
    }

    if (isDiagnosisBackendApiEnabled && session.questions.some((question) => question.diagnosisId)) {
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
      setStep("ready");
      createLearningLog({
        projectId,
        activityType: "diagnosis_completed",
        activitySummary: `${session.projectTitle} 수준 진단을 완료했습니다.`,
      }).catch(console.error);
    }, ANALYZING_DELAY_MS);

    return () => window.clearTimeout(timeout);
  }, [answers, projectId, session, step]);

  const currentQuestion = session.questions[questionIndex] || null;
  const visibleChoices = currentQuestion?.choices?.filter((choice) => choice.id !== "unknown") || [];
  const unknownChoiceId = currentQuestion?.choices?.find((choice) => choice.id === "unknown")?.id || "unknown";
  const selectedChoiceIds = getSelectedChoiceIds(draftAnswer);
  const isCurrentAnswerReady = currentQuestion ? isAnswerReady(currentQuestion, draftAnswer) : false;
  const conceptStatuses = useMemo(
    () => buildConceptStatuses(session, answers, questionIndex, step === "ready"),
    [answers, questionIndex, session, step]
  );
  const questionProgressRatio = session.totalQuestions
    ? Math.min(Math.max((questionIndex + 1) / session.totalQuestions, 0), 1)
    : 0;
  const introTimeLabel = "약 6분 소요";
  const completedQuestionCount = questionIndex;
  const remainingTimeValue = formatRemainingTime(completedQuestionCount);

  function updateCurrentAnswer(value) {
    if (!currentQuestion) {
      return;
    }

    if (currentQuestion.type !== "multiple-choice") {
      setDraftAnswer(value);
      return;
    }

    setDraftAnswer((currentAnswer) => {
      const currentChoiceIds = getSelectedChoiceIds(currentAnswer);

      if (currentChoiceIds.includes(value)) {
        return currentChoiceIds.filter((choiceId) => choiceId !== value);
      }

      return [...currentChoiceIds, value];
    });
  }

  async function handleStartLearning() {
    const targetProjectId = projectId || session.projectId || projectData.id;

    if (!targetProjectId) {
      router.push("/dashboard");
      return;
    }

    const nextWorkspaceState = setLastOpenedProject(loadWorkspaceState(), targetProjectId);
    saveWorkspaceState(nextWorkspaceState);

    try {
      if (isDiagnosisBackendApiEnabled && session?.id) {
        await createApiDiagnosisReport(targetProjectId, session.id);
        router.push(`/dashboard?projectId=${encodeURIComponent(targetProjectId)}`);
        return;
      }

      const targetChat = await createDiagnosisReportChat(targetProjectId);
      const params = new URLSearchParams({ projectId: targetChat?.projectId || targetProjectId });

      if (targetChat?.id) {
        params.set("chatId", targetChat.id);
      }

      router.push(`/dashboard?${params.toString()}`);
    } catch (error) {
      console.error(error);
      router.push(`/dashboard?projectId=${encodeURIComponent(targetProjectId)}`);
    }
  }

  function handleViewReview() {
    // 풀이보기 - 기능 미구현 (UI placeholder)
    // 추후: GET /diagnosis/{project_id}/sessions/{session_id}/review 연결
  }

  async function handleAdvance(nextAnswer = null) {
    if (!currentQuestion) {
      return;
    }

    const resolvedAnswer = nextAnswer !== null ? nextAnswer : draftAnswer;

    if (!isAnswerReady(currentQuestion, resolvedAnswer)) {
      return;
    }

    const nextAnswers = {
      ...answers,
      [currentQuestion.id]: resolvedAnswer,
    };

    setAnswers(nextAnswers);
    setDraftAnswer(createEmptyDraftAnswer(currentQuestion));

    if (isDiagnosisBackendApiEnabled && currentQuestion.diagnosisId) {
      const selectedChoiceIds = getSelectedChoiceIds(resolvedAnswer);
      const selectedChoices = currentQuestion.choices.filter((choice) => selectedChoiceIds.includes(choice.id));
      const selectedOptionIds = selectedChoices.map((choice) => choice.optionId).filter(Boolean);
      const isSkipped = selectedChoiceIds.length === 1 && selectedChoiceIds[0] === unknownChoiceId;

      setStep("analyzing");

      try {
        const result = await submitApiDiagnosisAnswer(
          projectId,
          session.id,
          currentQuestion.diagnosisId,
          {
            selectedOptionIds,
            isSkipped,
          }
        );
        const status = await getApiDiagnosisStatus(projectId, session.id).catch(() => null);
        const correctOptionIds = Array.isArray(result.correct_option_ids) ? result.correct_option_ids : [];
        const correctChoiceIdsFromOptions = correctOptionIds.length
          ? currentQuestion.choices
              .filter((choice) => choice.optionId && correctOptionIds.includes(choice.optionId))
              .map((choice) => choice.id)
          : [];
        const wasCorrect = result.is_fully_correct ?? result.is_correct;
        const checkedQuestion = {
          ...currentQuestion,
          correctChoiceIds: correctChoiceIdsFromOptions.length
            ? correctChoiceIdsFromOptions
            : wasCorrect
              ? getSelectedChoiceIds(resolvedAnswer)
              : [],
        };
        const checkedSession = {
          ...session,
          questions: session.questions.map((question) => (question.id === currentQuestion.id ? checkedQuestion : question)),
        };
        const conceptStatuses = buildConceptStatuses(
          checkedSession,
          nextAnswers,
          checkedSession.questions.length,
          true
        );
        const nextAssessment = {
          levelTitle: wasCorrect ? "현재 수준: 핵심 개념 이해" : "현재 수준: 개념 기초부터 보강 필요",
          measuredLevel:
            status?.measured_level ||
            status?.result_level ||
            status?.level ||
            (wasCorrect ? "상급" : "초급"),
          summary: wasCorrect
            ? `${session.projectTitle} 기준 진단 질문에 정답 처리되었습니다.`
            : `${session.projectTitle} 기준 추가 학습이 필요한 개념이 확인되었습니다.`,
          missingConcepts: conceptStatuses
            .filter((concept) => concept.tone === diagnosisStatusMap.needsReview.tone)
            .map((concept) => concept.label),
          roadmap: wasCorrect ? ["응용 질문으로 개념 연결 확장"] : ["오답 개념 다시 정리", "예시 기반 설명으로 보강"],
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
        setStep("ready");
        createLearningLog({
          projectId,
          activityType: "diagnosis_completed",
          activitySummary: `${session.projectTitle} 수준 진단을 완료했습니다.`,
        }).catch(console.error);
      } catch (error) {
        setDiagnosisError(error instanceof Error ? error.message : "진단 답변을 제출하지 못했습니다.");
        setDraftAnswer(resolvedAnswer);
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

    setDraftAnswer(createEmptyDraftAnswer(session.questions[questionIndex + 1]));
    setQuestionIndex((current) => current + 1);
  }

  return (
    <main className={`diagnosis-flow-shell diagnosis-flow-shell-${step}`}>
      <div className="diagnosis-flow-orb diagnosis-flow-orb-left" aria-hidden="true" />
      <div className="diagnosis-flow-orb diagnosis-flow-orb-right" aria-hidden="true" />
      <div className="diagnosis-flow-stars" aria-hidden="true" />

      {step === "intro" ? (
        <section className="diagnosis-flow-centered">
          <div className="diagnosis-flow-copy diagnosis-flow-intro-copy">
            <EeumMark />
            <h1>이음이 나를 알아가는 시간이에요</h1>
            <p>
              물음에 편하게 답해주세요.
              <br />
              답하기 어려우면 &quot;잘 모르겠어요&quot;를 눌러도 괜찮아요 ☺
            </p>
            {diagnosisError ? <small className="diagnosis-flow-error">{diagnosisError}</small> : null}
            <button type="button" className="diagnosis-flow-start-button" onClick={() => setStep("quiz")}>
              진단 시작하기 <span>→</span>
            </button>
            <div className="diagnosis-flow-meta">
              <span>📋 약 {session.totalQuestions}문항</span>
              <span>⏱ {introTimeLabel}</span>
              <span>🎯 수준 자동 분석</span>
            </div>
          </div>
        </section>
      ) : null}

      {step === "quiz" && currentQuestion ? (
        <section className="diagnosis-flow-quiz">
          <header className="diagnosis-flow-page-header">
            <div className="diagnosis-flow-brand">
              <EeumMark />
              <strong>이음</strong>
              <span>/</span>
              <b>수준 진단</b>
            </div>
          </header>

          <section className="diagnosis-flow-summary-card">
            <div className="diagnosis-flow-summary-progress">
              <span>진행률</span>
              <div className="diagnosis-flow-progress-bar">
                <div style={{ width: `${questionProgressRatio * 100}%` }} />
              </div>
              <strong>
                {questionIndex + 1} / {session.totalQuestions}
              </strong>
            </div>
            <div>
              <span>예상 남은 시간</span>
              <strong>약 {remainingTimeValue}</strong>
            </div>
          </section>

          <div className="diagnosis-flow-panels">
            <section className="diagnosis-flow-question-card">
              <div className="diagnosis-flow-question-subject">
                <span>🎯 {projectData.title}</span>
                <b>
                  나를 파악하는 중이에요 · {questionIndex + 1} / {session.totalQuestions}
                </b>
              </div>

              <h2>{renderQuestionPrompt(currentQuestion.prompt)}</h2>
              {diagnosisError ? <p className="diagnosis-flow-error">{diagnosisError}</p> : null}

              {currentQuestion.type === "multiple-choice" ? (
                <div className="diagnosis-flow-choice-list">
                  {visibleChoices.map((choice, index) => (
                    <button
                      key={choice.id}
                      type="button"
                      className={`diagnosis-flow-choice ${
                        selectedChoiceIds.includes(choice.id) ? "diagnosis-flow-choice-active" : ""
                      }`}
                      onClick={() => updateCurrentAnswer(choice.id)}
                    >
                      <span className="diagnosis-flow-choice-index">{String.fromCharCode(65 + index)}</span>
                      <span>{choice.label}</span>
                      {selectedChoiceIds.includes(choice.id) ? <span className="diagnosis-flow-choice-check">✓</span> : null}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="diagnosis-flow-answer-wrap">
                  <textarea
                    rows={6}
                    value={draftAnswer}
                    onChange={(event) => updateCurrentAnswer(event.target.value)}
                    placeholder={currentQuestion.placeholder}
                  />
                </div>
              )}

              <div className="diagnosis-flow-actions">
                <button
                  type="button"
                  className="diagnosis-flow-action diagnosis-flow-action-secondary"
                  onClick={() => handleAdvance(currentQuestion.type === "short-answer" ? "잘 모르겠어요." : unknownChoiceId)}
                >
                  잘 모르겠어요
                </button>
                <button
                  type="button"
                  className="diagnosis-flow-action diagnosis-flow-action-primary"
                  onClick={() => handleAdvance()}
                  disabled={!isCurrentAnswerReady}
                >
                  {questionIndex >= session.totalQuestions - 1 ? "분석 시작하기" : "다음 질문"} <span>→</span>
                </button>
              </div>
            </section>

            <aside className="diagnosis-flow-sidecard">
              <h2>진단 개념 목록</h2>
              <div className="diagnosis-flow-concept-list">
                {conceptStatuses.map((concept) => (
                  <article
                    key={concept.id}
                    className={`diagnosis-flow-concept-item diagnosis-flow-concept-item-${concept.tone}`}
                  >
                    <strong>{concept.label}</strong>
                    <span className="diagnosis-flow-concept-status">{getConceptStatusText(concept)}</span>
                  </article>
                ))}
              </div>
            </aside>
          </div>
        </section>
      ) : null}

      {step === "analyzing" ? (
        <section className="diagnosis-flow-centered diagnosis-flow-analyzing">
          <div className="diagnosis-flow-copy diagnosis-flow-copy-wide">
            <AnalysisLoadingMark />
            <h1>이음이 분석하고 있어요</h1>
            <p>나에게 맞는 학습 설정을 준비하는 중이에요</p>
            <SparkDots />
          </div>
        </section>
      ) : null}

      {step === "ready" ? (
        <section className="diagnosis-flow-centered">
          <div className="diagnosis-flow-copy diagnosis-flow-ready-copy">
            <CelebrationMark />
            <h1>준비됐어요!</h1>
            <p>이제 대화할 때마다 딱 맞는 설명을 드릴게요</p>
            <div className="diagnosis-flow-ready-actions">
              <button
                type="button"
                className="diagnosis-flow-start-button"
                onClick={handleViewReview}
              >
                풀이보기 <span>→</span>
              </button>
              <button type="button" className="diagnosis-flow-start-button" onClick={handleStartLearning}>
                학습하기 <span>→</span>
              </button>
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
}
