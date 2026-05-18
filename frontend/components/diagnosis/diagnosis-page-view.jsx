"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import EeumIcon from "@/components/common/EeumIcon";
import { LandingBackgroundLayer } from "@/components/landing/landing-background-layer";
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
  getApiDiagnosisNodes,
  getApiDiagnosisReview,
  getApiDiagnosisStatus,
  isDiagnosisBackendApiEnabled,
  submitApiDiagnosisAnswer,
} from "../../features/diagnosis/api-service";
import { createDiagnosisReportChat, getProjects } from "../../features/dashboard/service";
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
const DIAGNOSIS_DEFAULT_TOTAL_QUESTIONS = 12;
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
  if (choice && typeof choice === "object") {
    const optionId = choice.option_id ?? choice.optionId ?? null;
    const id = String(choice.id ?? optionId ?? choice.choice_id ?? choice.value ?? index);
    return {
      ...choice,
      id,
      optionId: optionId !== null ? String(optionId) : null,
      label: choice.label || choice.text || choice.name || choice.title || String(choice.value ?? index),
    };
  }

  return {
    id: String(index),
    optionId: null,
    label: String(choice),
  };
}

function getQuestionCorrectChoiceIds(question) {
  const correctChoiceIds =
    question?.correctChoiceIds ||
    question?.correct_choice_ids ||
    (question?.correctChoiceId ? [question.correctChoiceId] : []);

  return correctChoiceIds.filter(Boolean).map((choiceId) => String(choiceId));
}

function normalizeReviewChoice(choice, index, selectedIds, correctIds) {
  const optionId = choice?.option_id ?? choice?.optionId ?? choice?.id ?? index;
  const id = String(choice?.id ?? optionId);
  const normalizedOptionId = String(optionId);
  const label = choice?.text || choice?.label || choice?.name || String(choice ?? "");

  return {
    id,
    optionId: normalizedOptionId,
    label,
    isCorrect: Boolean(choice?.is_correct) || correctIds.includes(id) || correctIds.includes(normalizedOptionId),
    isSelected: Boolean(choice?.is_selected) || selectedIds.includes(id) || selectedIds.includes(normalizedOptionId),
  };
}

function buildLocalReviewItems(session, answers) {
  return session.questions.map((question) => {
    const selectedIds = getSelectedChoiceIds(answers[question.id]);
    const correctIds = getQuestionCorrectChoiceIds(question);
    const choices = (question.choices || [])
      .filter((choice) => choice.id !== "unknown" || selectedIds.includes(choice.id))
      .map((choice, index) => normalizeReviewChoice(choice, index, selectedIds, correctIds));
    const isFullyCorrect =
      correctIds.length > 0 &&
      selectedIds.length === correctIds.length &&
      selectedIds.every((choiceId) => correctIds.includes(choiceId));

    return {
      questionId: question.id,
      question: question.prompt,
      choices,
      correctOptionIds: correctIds,
      selectedOptionIds: selectedIds,
      isFullyCorrect,
      partialScore: null,
      answerScore: isFullyCorrect ? 1 : 0,
      explanation: question.explanation || "이 문항의 해설이 아직 준비되지 않았습니다.",
    };
  });
}

export default function DiagnosisPageView({ projectId }) {
  const router = useRouter();
  const [projectData, setProjectData] = useState(() => {
    const initialProjectData = getProjectData(projectId);

    return isDiagnosisBackendApiEnabled ? { ...initialProjectData, title: "프로젝트" } : initialProjectData;
  });
  const [isProjectDataReady, setIsProjectDataReady] = useState(!isDiagnosisBackendApiEnabled);
  const [step, setStep] = useState("intro");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [draftAnswer, setDraftAnswer] = useState("");
  const [apiSession, setApiSession] = useState(null);
  const [isInitialQuestionLoading, setIsInitialQuestionLoading] = useState(false);
  const [reviewItems, setReviewItems] = useState([]);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [isReviewLoading, setIsReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState(null);
  const [diagnosisError, setDiagnosisError] = useState(null);
  const initializedDiagnosisSessionRef = useRef(null);
  const initialQuestionRequestRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function loadProjectData() {
      setIsProjectDataReady(false);

      const workspaceState = loadWorkspaceState();
      const fallbackProjectData = getProjectData(projectId, workspaceState);

      if (!isDiagnosisBackendApiEnabled) {
        if (!cancelled) {
          setProjectData(fallbackProjectData);
          setIsProjectDataReady(true);
        }
        return;
      }

      setProjectData({ ...fallbackProjectData, title: "프로젝트" });

      try {
        const projects = await getProjects();

        if (cancelled) {
          return;
        }

        const backendProject = projects.find((project) => project.id === String(projectId));
        const fallbackTitle = fallbackProjectData.title === `${projectId} 프로젝트` ? "프로젝트" : fallbackProjectData.title;

        setProjectData({
          ...fallbackProjectData,
          title: backendProject?.title || fallbackTitle,
        });
      } catch {
        if (!cancelled) {
          const fallbackTitle =
            fallbackProjectData.title === `${projectId} 프로젝트` ? "프로젝트" : fallbackProjectData.title;

          setProjectData({
            ...fallbackProjectData,
            title: fallbackTitle,
          });
        }
      } finally {
        if (!cancelled) {
          setIsProjectDataReady(true);
        }
      }
    }

    loadProjectData();

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const fallbackSession = useMemo(
    () => (isDiagnosisBackendApiEnabled ? null : createDiagnosisSession(projectData)),
    [projectData]
  );
  const emptyApiSession = useMemo(
    () => ({
      id: null,
      projectId,
      projectTitle: projectData.title,
      totalQuestions: DIAGNOSIS_DEFAULT_TOTAL_QUESTIONS,
      estimatedMinutes: 6,
      concepts: [],
      questions: [],
    }),
    [projectData.title, projectId]
  );
  const session = isDiagnosisBackendApiEnabled ? apiSession || emptyApiSession : fallbackSession;

  useEffect(() => {
    if (!isDiagnosisBackendApiEnabled) {
      setApiSession(null);
      setDiagnosisError(null);
      setIsInitialQuestionLoading(false);
      return;
    }

    initializedDiagnosisSessionRef.current = null;
    initialQuestionRequestRef.current = null;
    setApiSession(null);
    setAnswers({});
    setDraftAnswer("");
    setQuestionIndex(0);
    setStep("intro");
    setDiagnosisError(null);
    setReviewItems([]);
    setReviewIndex(0);
    setReviewError(null);
    setIsReviewLoading(false);
    setIsInitialQuestionLoading(false);
  }, [projectId]);

  async function loadInitialApiSession() {
    if (!isDiagnosisBackendApiEnabled || !projectId || !isProjectDataReady) {
      return null;
    }

    if (apiSession?.questions?.length) {
      return apiSession;
    }

    if (initialQuestionRequestRef.current) {
      return initialQuestionRequestRef.current;
    }

    const request = (async () => {
      setIsInitialQuestionLoading(true);
      setDiagnosisError(null);

      try {
        const diagnosisSession = await createApiDiagnosisSession(projectId);
        const sessionId = diagnosisSession?.session_id;

        if (!sessionId) {
          throw new Error("진단 세션을 생성하지 못했습니다.");
        }

        const [question, status] = await Promise.all([
          createApiDiagnosisQuestion(projectId, sessionId),
          getApiDiagnosisStatus(projectId, sessionId).catch(() => null),
        ]);

        const choices = Array.isArray(question.choices) ? question.choices : [];
        const apiQuestion = {
          ...question,
          node_id: question.concept_id || question.node_id,
        };
        const diagnosisNodes = question.question_id
          ? await getApiDiagnosisNodes(projectId, question.question_id).catch(() => [])
          : [];
        const concepts = buildApiDiagnosisConcepts(diagnosisNodes, apiQuestion);
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
          difficulty: question.difficulty,
          order: 1,
        });

        const totalFromStatus =
          typeof status?.total_questions === "number" && status.total_questions > 0
            ? status.total_questions
            : DIAGNOSIS_DEFAULT_TOTAL_QUESTIONS;

        const nextSession = {
          id: sessionId,
          projectId,
          projectTitle: projectData.title,
          totalQuestions: totalFromStatus,
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
        };

        initializedDiagnosisSessionRef.current = `${projectId || nextSession.projectId || "project"}:${nextSession.id}`;
        setAnswers(createEmptyAnswers(nextSession));
        setDraftAnswer(createEmptyDraftAnswer(normalizedQuestion));
        setQuestionIndex(0);
        setApiSession(nextSession);
        return nextSession;
      } catch (error) {
        setDiagnosisError(error instanceof Error ? error.message : "진단 질문을 불러오지 못했습니다.");
        setApiSession(null);
        return null;
      } finally {
        initialQuestionRequestRef.current = null;
        setIsInitialQuestionLoading(false);
      }
    })();

    initialQuestionRequestRef.current = request;
    return request;
  }

  async function handleStartDiagnosis() {
    if (!isDiagnosisBackendApiEnabled) {
      setStep("quiz");
      return;
    }

    const readySession = apiSession?.questions?.length ? apiSession : await loadInitialApiSession();

    if (readySession?.questions?.length) {
      setStep("quiz");
    }
  }

  useEffect(() => {
    if (isDiagnosisBackendApiEnabled) {
      return;
    }

    if (!session.id || !session.questions.length) {
      return;
    }

    const sessionKey = `${projectId || session.projectId || "project"}:${session.id}`;
    if (initializedDiagnosisSessionRef.current === sessionKey) {
      return;
    }

    initializedDiagnosisSessionRef.current = sessionKey;
    setAnswers(createEmptyAnswers(session));
    setDraftAnswer(createEmptyDraftAnswer(session.questions[0]));
    setQuestionIndex(0);
    setStep("intro");
  }, [projectId, session.id, session.projectId, session.questions.length]);

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
  const currentReviewItem = reviewItems[reviewIndex] || null;
  const reviewProgressRatio = reviewItems.length
    ? Math.min(Math.max((reviewIndex + 1) / reviewItems.length, 0), 1)
    : 0;

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
      const isUnknownChoice = value === unknownChoiceId;

      if (isUnknownChoice) {
        return currentChoiceIds.includes(value) ? [] : [value];
      }

      const currentChoiceIdsWithoutUnknown = currentChoiceIds.filter((choiceId) => choiceId !== unknownChoiceId);

      if (currentChoiceIdsWithoutUnknown.includes(value)) {
        return currentChoiceIdsWithoutUnknown.filter((choiceId) => choiceId !== value);
      }

      return [...currentChoiceIdsWithoutUnknown, value];
    });
  }

  function navigateToDashboard() {
    const targetProjectId = projectId || session.projectId || projectData.id;

    if (!targetProjectId) {
      router.push("/dashboard");
      return;
    }

    const nextWorkspaceState = setLastOpenedProject(loadWorkspaceState(), targetProjectId);
    saveWorkspaceState(nextWorkspaceState);
    router.push(`/dashboard?projectId=${encodeURIComponent(targetProjectId)}`);
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

  async function handleViewReview() {
    setReviewError(null);

    if (reviewItems.length) {
      setReviewIndex(0);
      setStep("review");
      return;
    }

    if (!isDiagnosisBackendApiEnabled) {
      setReviewItems(buildLocalReviewItems(session, answers));
      setReviewIndex(0);
      setStep("review");
      return;
    }

    if (!projectId || !session?.id) {
      setReviewError("풀이를 불러올 진단 세션을 찾지 못했습니다.");
      return;
    }

    setIsReviewLoading(true);

    try {
      const reviews = await getApiDiagnosisReview(projectId, session.id);
      const nextReviewItems = Array.isArray(reviews) ? reviews : [];

      if (!nextReviewItems.length) {
        throw new Error("풀이를 불러올 문항이 없습니다.");
      }

      setReviewItems(nextReviewItems);
      setReviewIndex(0);
      setStep("review");
    } catch (error) {
      console.error(error);
      setReviewError(error instanceof Error ? error.message : "풀이를 불러오지 못했습니다.");
    } finally {
      setIsReviewLoading(false);
    }
  }

  async function handleAdvance(nextAnswer = null) {
    if (!currentQuestion) {
      return;
    }

    const resolvedAnswer = nextAnswer !== null ? nextAnswer : draftAnswer;

    if (!isAnswerReady(currentQuestion, resolvedAnswer)) {
      return;
    }

    setDiagnosisError(null);

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
      const selectedIndex =
        currentQuestion.type === "multiple-choice"
          ? currentQuestion.choices.findIndex((choice) => choice.id === selectedChoiceIds[0])
          : 0;

      setStep("analyzing");

      try {
        const result = await submitApiDiagnosisAnswer(
          projectId,
          session.id,
          currentQuestion.diagnosisId,
          {
            selectedIndex: selectedOptionIds.length ? null : selectedIndex,
            selectedOptionIds: selectedOptionIds.length ? selectedOptionIds : null,
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

        const totalFromStatus =
          typeof status?.total_questions === "number" && status.total_questions > 0
            ? status.total_questions
            : session.totalQuestions || DIAGNOSIS_DEFAULT_TOTAL_QUESTIONS;
        const answeredCount =
          typeof status?.answered === "number" ? status.answered : Object.keys(nextAnswers).length;
        const isCompleted = answeredCount >= totalFromStatus;

        const sessionAfterCheck = {
          ...session,
          totalQuestions: totalFromStatus,
          questions: session.questions.map((question) =>
            question.id === currentQuestion.id ? checkedQuestion : question
          ),
        };

        if (!isCompleted) {
          let nextQuestion = null;
          try {
            nextQuestion = await createApiDiagnosisQuestion(projectId, session.id);
          } catch (fetchError) {
            setDiagnosisError(
              fetchError instanceof Error ? fetchError.message : "다음 진단 질문을 불러오지 못했습니다."
            );
            setDraftAnswer(resolvedAnswer);
            setApiSession(sessionAfterCheck);
            setStep("quiz");
            return;
          }

          if (nextQuestion?.question_id) {
            const choices = Array.isArray(nextQuestion.choices) ? nextQuestion.choices : [];
            const fallbackConceptId =
              nextQuestion.concept_id || nextQuestion.node_id || `api-concept-${answeredCount + 1}`;
            const apiQuestion = {
              ...nextQuestion,
              node_id: nextQuestion.concept_id || nextQuestion.node_id,
            };
            const diagnosisNodes = await getApiDiagnosisNodes(projectId, nextQuestion.question_id).catch(() => []);
            const concepts = buildApiDiagnosisConcepts(
              diagnosisNodes.length ? diagnosisNodes : sessionAfterCheck.concepts,
              apiQuestion
            );
            const normalizedNext = normalizeDiagnosisQuestion({
              id: nextQuestion.question_id,
              diagnosisId: nextQuestion.question_id,
              type: "multiple-choice",
              questionType: nextQuestion.question_type || null,
              isMultiSelect: nextQuestion.question_type === "multi_select",
              node_id: nextQuestion.concept_id || nextQuestion.node_id,
              node_name: nextQuestion.node_name || nextQuestion.concept_name || "진단 대상 개념",
              conceptIds: nextQuestion.conceptIds ||
                nextQuestion.concept_ids ||
                [
                  {
                    node_id: fallbackConceptId,
                    name: nextQuestion.node_name || nextQuestion.concept_name || "진단 대상 개념",
                  },
                ],
              prompt: nextQuestion.question,
              choices: choices.map(normalizeApiChoice),
              difficulty: nextQuestion.difficulty,
              order: answeredCount + 1,
            });

            setApiSession({
              ...sessionAfterCheck,
              concepts: concepts.length ? concepts : sessionAfterCheck.concepts,
              questions: [...sessionAfterCheck.questions, normalizedNext],
            });
            setDraftAnswer(createEmptyDraftAnswer(normalizedNext));
            setQuestionIndex((current) => current + 1);
            setStep("quiz");
            return;
          }
        }

        const conceptStatuses = buildConceptStatuses(
          sessionAfterCheck,
          nextAnswers,
          sessionAfterCheck.questions.length,
          true
        );
        const correctAnswerCount = sessionAfterCheck.questions.filter((question) => {
          const userChoiceIds = getSelectedChoiceIds(nextAnswers[question.id]);
          const correctIds = question.correctChoiceIds || [];
          return (
            correctIds.length > 0 &&
            userChoiceIds.length === correctIds.length &&
            userChoiceIds.every((choiceId) => correctIds.includes(choiceId))
          );
        }).length;
        const passedDiagnosis = correctAnswerCount > sessionAfterCheck.questions.length / 2;
        const nextAssessment = {
          levelTitle: passedDiagnosis ? "현재 수준: 핵심 개념 이해" : "현재 수준: 개념 기초부터 보강 필요",
          measuredLevel: passedDiagnosis ? "상급" : "초급",
          summary: passedDiagnosis
            ? `${session.projectTitle} 기준 진단 질문에 정답 처리되었습니다.`
            : `${session.projectTitle} 기준 추가 학습이 필요한 개념이 확인되었습니다.`,
          missingConcepts: conceptStatuses
            .filter((concept) => concept.tone === diagnosisStatusMap.needsReview.tone)
            .map((concept) => concept.label),
          roadmap: passedDiagnosis
            ? ["응용 질문으로 개념 연결 확장"]
            : ["오답 개념 다시 정리", "예시 기반 설명으로 보강"],
          conceptStatuses,
        };
        const workspaceState = loadWorkspaceState();
        const nextWorkspaceState = saveProjectDiagnosis(workspaceState, projectId, {
          savedAt: Date.now(),
          sessionId: session.id,
          totalQuestionCount: sessionAfterCheck.totalQuestions,
          completedQuestionCount: answeredCount,
          answers: nextAnswers,
          questions: sessionAfterCheck.questions,
          conceptStatuses,
          assessment: nextAssessment,
        });

        saveWorkspaceState(nextWorkspaceState);
        setApiSession(sessionAfterCheck);
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
      {step === "intro" ? (
        <LandingBackgroundLayer />
      ) : (
        <>
          <div className="diagnosis-flow-orb diagnosis-flow-orb-left" aria-hidden="true" />
          <div className="diagnosis-flow-orb diagnosis-flow-orb-right" aria-hidden="true" />
          <div className="diagnosis-flow-stars" aria-hidden="true" />
        </>
      )}

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
            <button
              type="button"
              className="diagnosis-flow-start-button"
              onClick={handleStartDiagnosis}
              disabled={isDiagnosisBackendApiEnabled && (!isProjectDataReady || isInitialQuestionLoading)}
            >
              {isDiagnosisBackendApiEnabled && (!isProjectDataReady || isInitialQuestionLoading)
                ? "진단 준비 중"
                : "진단 시작하기"} <span>→</span>
            </button>
            <div className="diagnosis-flow-meta">
              <span>📋 약 15문항</span>
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

      {step === "review" && currentReviewItem ? (
        <section className="diagnosis-flow-quiz diagnosis-flow-review">
          <header className="diagnosis-flow-page-header">
            <div className="diagnosis-flow-brand">
              <EeumMark />
              <strong>이음</strong>
              <span>/</span>
              <b>풀이보기</b>
            </div>
          </header>

          <section className="diagnosis-flow-summary-card">
            <div className="diagnosis-flow-summary-progress">
              <span>풀이 진행률</span>
              <div className="diagnosis-flow-progress-bar">
                <div style={{ width: `${reviewProgressRatio * 100}%` }} />
              </div>
              <strong>
                {reviewIndex + 1} / {reviewItems.length}
              </strong>
            </div>
          </section>

          <div className="diagnosis-flow-panels diagnosis-flow-review-panels">
            <section className="diagnosis-flow-question-card diagnosis-flow-review-card">
              <div className="diagnosis-flow-question-subject">
                <span>풀이</span>
                <b>
                  {currentReviewItem.is_fully_correct ?? currentReviewItem.isFullyCorrect
                    ? "정답으로 처리된 문항이에요"
                    : "다시 확인하면 좋은 문항이에요"}
                </b>
              </div>

              <h2>{renderQuestionPrompt(currentReviewItem.question)}</h2>

              <div className="diagnosis-flow-choice-list">
                {(currentReviewItem.choices || []).map((choice, index) => {
                  const isCorrect = Boolean(choice.is_correct ?? choice.isCorrect);
                  const isSelected = Boolean(choice.is_selected ?? choice.isSelected);
                  const reviewClassNames = [
                    "diagnosis-flow-choice",
                    "diagnosis-flow-choice-review",
                    isCorrect ? "diagnosis-flow-choice-correct" : "",
                    isSelected ? "diagnosis-flow-choice-selected" : "",
                    isSelected && !isCorrect ? "diagnosis-flow-choice-wrong" : "",
                  ]
                    .filter(Boolean)
                    .join(" ");

                  return (
                    <div key={choice.option_id || choice.optionId || choice.id || index} className={reviewClassNames}>
                      <span className="diagnosis-flow-choice-index">{String.fromCharCode(65 + index)}</span>
                      <span>{choice.text || choice.label}</span>
                      <span className="diagnosis-flow-review-badges">
                        {isSelected ? <b>내 선택</b> : null}
                        {isCorrect ? <b>정답</b> : null}
                      </span>
                    </div>
                  );
                })}
              </div>

              <section className="diagnosis-flow-review-explanation">
                <span>해설</span>
                <p>{currentReviewItem.explanation || "이 문항의 해설이 아직 준비되지 않았습니다."}</p>
              </section>

              <div className="diagnosis-flow-actions">
                <button
                  type="button"
                  className="diagnosis-flow-action diagnosis-flow-action-secondary"
                  onClick={() => setReviewIndex((current) => Math.max(current - 1, 0))}
                  disabled={reviewIndex === 0}
                >
                  이전 문제
                </button>
                <button
                  type="button"
                  className="diagnosis-flow-action diagnosis-flow-action-primary"
                  onClick={() => {
                    if (reviewIndex >= reviewItems.length - 1) {
                      navigateToDashboard();
                      return;
                    }

                    setReviewIndex((current) => current + 1);
                  }}
                >
                  {reviewIndex >= reviewItems.length - 1 ? "대시보드로 이동" : "다음 문제"} <span>→</span>
                </button>
              </div>
            </section>
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
                disabled={isReviewLoading}
              >
                {isReviewLoading ? "풀이 불러오는 중" : "풀이보기"} <span>→</span>
              </button>
              <button type="button" className="diagnosis-flow-start-button" onClick={handleStartLearning}>
                학습하기 <span>→</span>
              </button>
            </div>
            {reviewError ? <small className="diagnosis-flow-error">{reviewError}</small> : null}
          </div>
        </section>
      ) : null}
    </main>
  );
}
