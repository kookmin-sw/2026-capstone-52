"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import MarkdownContent from "@/components/common/MarkdownContent";
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
  getApiDiagnosisReview,
  getApiDiagnosisNodes,
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
const MOCK_QUESTION_TRANSITION_DELAY_MS = 640;
const DIAGNOSIS_DEFAULT_TOTAL_QUESTIONS = 12;
const FOLLOW_UP_SCORE_THRESHOLD = 0.4;
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

const loadingDotVariants = {
  jump: {
    y: -30,
    transition: {
      duration: 0.8,
      repeat: Infinity,
      repeatType: "mirror",
      ease: "easeInOut",
    },
  },
};

function LoadingThreeDotsJumping() {
  return (
    <motion.div
      animate="jump"
      transition={{ staggerChildren: -0.2, staggerDirection: -1 }}
      className="diagnosis-flow-next-loader"
      role="status"
      aria-label="다음 질문을 불러오는 중"
    >
      <motion.div className="diagnosis-flow-next-loader-dot" variants={loadingDotVariants} />
      <motion.div className="diagnosis-flow-next-loader-dot" variants={loadingDotVariants} />
      <motion.div className="diagnosis-flow-next-loader-dot" variants={loadingDotVariants} />
    </motion.div>
  );
}

function LoadingThreeDotsOverlay() {
  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="diagnosis-flow-next-loading">
      <LoadingThreeDotsJumping />
    </div>,
    document.body
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

function buildDashboardChatId(projectId, chatSessionId) {
  if (!projectId || chatSessionId === null || chatSessionId === undefined) {
    return null;
  }

  return `${projectId}-session-${chatSessionId}`;
}

function areSameChoiceSets(leftIds, rightIds) {
  const left = new Set((leftIds || []).map(String));
  const right = new Set((rightIds || []).map(String));

  return left.size === right.size && Array.from(left).every((choiceId) => right.has(choiceId));
}

function buildMockDiagnosisReviewItems(session, answers) {
  return (session.questions || []).map((question) => {
    const selectedChoiceIds = getSelectedChoiceIds(answers[question.id]);
    const correctChoiceIds =
      question.correctChoiceIds || question.correct_choice_ids || (question.correctChoiceId ? [question.correctChoiceId] : []);
    const normalizedCorrectChoiceIds = correctChoiceIds.map(String);
    const normalizedSelectedChoiceIds = selectedChoiceIds.map(String);

    return {
      question_id: question.id,
      concept_id: Array.isArray(question.conceptIds) ? question.conceptIds[0] : question.node_id,
      question: question.prompt,
      choices: (question.choices || [])
        .filter((choice) => choice.id !== "unknown")
        .map((choice) => ({
          option_id: choice.optionId || choice.id,
          text: choice.label || choice.text || "",
          is_correct: normalizedCorrectChoiceIds.includes(String(choice.id)),
          is_selected: normalizedSelectedChoiceIds.includes(String(choice.id)),
        })),
      correct_option_ids: normalizedCorrectChoiceIds,
      selected_option_ids: normalizedSelectedChoiceIds,
      is_fully_correct: areSameChoiceSets(normalizedSelectedChoiceIds, normalizedCorrectChoiceIds),
      explanation: question.explanation || "",
    };
  });
}

function getDiagnosisReviewExplanation(item) {
  const candidates = [
    item?.explanation,
    item?.answer_explanation,
    item?.answerExplanation,
    item?.solution,
    item?.solution_text,
    item?.solutionText,
    item?.reason,
  ];

  const explanation = candidates.find((value) => typeof value === "string" && value.trim());

  return explanation || "";
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
  const [isQuestionTransitionLoading, setIsQuestionTransitionLoading] = useState(false);
  const [isFollowUpQuestion, setIsFollowUpQuestion] = useState(false);
  const [diagnosisError, setDiagnosisError] = useState(null);
  const [diagnosisReviewItems, setDiagnosisReviewItems] = useState([]);
  const [diagnosisReviewIndex, setDiagnosisReviewIndex] = useState(0);
  const [isDiagnosisReviewLoading, setIsDiagnosisReviewLoading] = useState(false);
  const [diagnosisReviewError, setDiagnosisReviewError] = useState(null);
  const initializedDiagnosisSessionRef = useRef(null);
  const initialQuestionRequestRef = useRef(null);
  const questionTransitionTimeoutRef = useRef(null);

  useEffect(() => {
    return () => {
      if (questionTransitionTimeoutRef.current) {
        window.clearTimeout(questionTransitionTimeoutRef.current);
      }
    };
  }, []);

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
      completedQuestionCount: 0,
      estimatedMinutes: 6,
      concepts: [],
      questions: [],
    }),
    [projectData.title, projectId]
  );
  const session = isDiagnosisBackendApiEnabled ? apiSession || emptyApiSession : fallbackSession;

  useEffect(() => {
    if (questionTransitionTimeoutRef.current) {
      window.clearTimeout(questionTransitionTimeoutRef.current);
      questionTransitionTimeoutRef.current = null;
    }

    if (!isDiagnosisBackendApiEnabled) {
      setApiSession(null);
      setDiagnosisError(null);
      setIsInitialQuestionLoading(false);
      setIsQuestionTransitionLoading(false);
      setIsFollowUpQuestion(false);
      setDiagnosisReviewItems([]);
      setDiagnosisReviewIndex(0);
      setDiagnosisReviewError(null);
      setIsDiagnosisReviewLoading(false);
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
    setDiagnosisReviewItems([]);
    setDiagnosisReviewIndex(0);
    setDiagnosisReviewError(null);
    setIsDiagnosisReviewLoading(false);
    setIsInitialQuestionLoading(false);
    setIsQuestionTransitionLoading(false);
    setIsFollowUpQuestion(false);
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
        const answeredFromStatus = typeof status?.answered === "number" ? status.answered : 0;

        const nextSession = {
          id: sessionId,
          projectId,
          projectTitle: projectData.title,
          totalQuestions: totalFromStatus,
          completedQuestionCount: Math.min(answeredFromStatus, totalFromStatus),
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
        setIsFollowUpQuestion(false);
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
    setIsFollowUpQuestion(false);
    setDiagnosisReviewItems([]);
    setDiagnosisReviewIndex(0);
    setDiagnosisReviewError(null);

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
    setIsFollowUpQuestion(false);
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
    () => buildConceptStatuses(session, answers, questionIndex, step === "ready" || step === "review"),
    [answers, questionIndex, session, step]
  );
  const totalQuestionCount = session.totalQuestions || DIAGNOSIS_DEFAULT_TOTAL_QUESTIONS;
  const completedQuestionCount =
    typeof session.completedQuestionCount === "number"
      ? session.completedQuestionCount
      : isDiagnosisBackendApiEnabled
        ? 0
        : questionIndex;
  const boundedCompletedQuestionCount = Math.min(Math.max(completedQuestionCount, 0), totalQuestionCount);
  const progressPercent = totalQuestionCount
    ? Math.min(Math.max(Math.round((boundedCompletedQuestionCount / totalQuestionCount) * 100), 0), 100)
    : 0;

  function updateCurrentAnswer(value) {
    if (!currentQuestion || isQuestionTransitionLoading) {
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
        const reportResponse = await createApiDiagnosisReport(targetProjectId, session.id);
        const chatId = buildDashboardChatId(targetProjectId, reportResponse?.chat_session?.id);
        const params = new URLSearchParams({ projectId: String(targetProjectId) });

        if (chatId) {
          params.set("chatId", chatId);
        }

        router.push(`/dashboard?${params.toString()}`);
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
    if (isDiagnosisReviewLoading) {
      return;
    }

    if (diagnosisReviewItems.length) {
      setDiagnosisReviewIndex((current) => Math.min(current, diagnosisReviewItems.length - 1));
      setStep("review");
      return;
    }

    setDiagnosisReviewError(null);

    if (!isDiagnosisBackendApiEnabled) {
      setDiagnosisReviewItems(buildMockDiagnosisReviewItems(session, answers));
      setDiagnosisReviewIndex(0);
      setStep("review");
      return;
    }

    const targetProjectId = projectId || session.projectId || projectData.id;

    if (!targetProjectId || !session?.id) {
      setDiagnosisReviewError("진단 세션 정보를 찾지 못했습니다.");
      setStep("review");
      return;
    }

    setIsDiagnosisReviewLoading(true);

    try {
      const reviewItems = await getApiDiagnosisReview(targetProjectId, session.id);
      setDiagnosisReviewItems(Array.isArray(reviewItems) ? reviewItems : []);
      setDiagnosisReviewIndex(0);
      setStep("review");
    } catch (error) {
      setDiagnosisReviewError(error instanceof Error ? error.message : "풀이를 불러오지 못했습니다.");
      setStep("review");
    } finally {
      setIsDiagnosisReviewLoading(false);
    }
  }

  async function handleAdvance(nextAnswer = null) {
    if (!currentQuestion || isQuestionTransitionLoading) {
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

    const isBackendDiagnosisQuestion = isDiagnosisBackendApiEnabled && currentQuestion.diagnosisId;

    setAnswers(nextAnswers);

    if (isBackendDiagnosisQuestion) {
      const selectedChoiceIds = getSelectedChoiceIds(resolvedAnswer);
      const selectedChoices = currentQuestion.choices.filter((choice) => selectedChoiceIds.includes(choice.id));
      const selectedOptionIds = selectedChoices.map((choice) => choice.optionId).filter(Boolean);
      const isSkipped = selectedChoiceIds.length === 1 && selectedChoiceIds[0] === unknownChoiceId;
      const selectedIndex =
        currentQuestion.type === "multiple-choice"
          ? currentQuestion.choices.findIndex((choice) => choice.id === selectedChoiceIds[0])
          : 0;

      setIsQuestionTransitionLoading(true);

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
        const answerScore = typeof result.answer_score === "number" ? result.answer_score : null;
        const shouldPauseForFollowUp = answerScore !== null && answerScore < FOLLOW_UP_SCORE_THRESHOLD;
        const currentCompletedQuestionCount =
          typeof session.completedQuestionCount === "number"
            ? session.completedQuestionCount
            : Math.max(answeredCount - 1, 0);
        const nextCompletedQuestionCount = shouldPauseForFollowUp
          ? currentCompletedQuestionCount
          : Math.min(currentCompletedQuestionCount + 1, totalFromStatus);
        const isCompleted = answeredCount >= totalFromStatus;

        const sessionAfterCheck = {
          ...session,
          totalQuestions: totalFromStatus,
          completedQuestionCount: nextCompletedQuestionCount,
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
            setIsFollowUpQuestion(false);
            setIsQuestionTransitionLoading(false);
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
            setIsFollowUpQuestion(shouldPauseForFollowUp);
            setIsQuestionTransitionLoading(false);
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
        if (isDiagnosisBackendApiEnabled && session.id) {
          try {
            const reportResponse = await createApiDiagnosisReport(projectId, session.id);
            setDiagnosisReport(reportResponse);
            setDiagnosisReportError(null);
          } catch (reportError) {
            setDiagnosisReport(null);
            setDiagnosisReportError(
              reportError instanceof Error ? reportError.message : "수준진단 리포트를 생성하지 못했습니다."
            );
          }
        }
        setStep("ready");
        setIsFollowUpQuestion(false);
        setIsQuestionTransitionLoading(false);
        createLearningLog({
          projectId,
          activityType: "diagnosis_completed",
          activitySummary: `${session.projectTitle} 수준 진단을 완료했습니다.`,
        }).catch(console.error);
      } catch (error) {
        setDiagnosisError(error instanceof Error ? error.message : "진단 답변을 제출하지 못했습니다.");
        setDraftAnswer(resolvedAnswer);
        setStep("quiz");
        setIsQuestionTransitionLoading(false);
      }

      return;
    }

    if (questionIndex >= session.totalQuestions - 1) {
      setIsQuestionTransitionLoading(true);
      questionTransitionTimeoutRef.current = window.setTimeout(() => {
        setDraftAnswer(createEmptyDraftAnswer(currentQuestion));
        setStep("analyzing");
        setIsQuestionTransitionLoading(false);
        questionTransitionTimeoutRef.current = null;
      }, FINAL_PROGRESS_DELAY_MS);
      return;
    }

    setIsQuestionTransitionLoading(true);
    questionTransitionTimeoutRef.current = window.setTimeout(() => {
      setDraftAnswer(createEmptyDraftAnswer(session.questions[questionIndex + 1]));
      setQuestionIndex((current) => current + 1);
      setIsQuestionTransitionLoading(false);
      questionTransitionTimeoutRef.current = null;
    }, MOCK_QUESTION_TRANSITION_DELAY_MS);
  }

  const boundedDiagnosisReviewIndex = diagnosisReviewItems.length
    ? Math.min(Math.max(diagnosisReviewIndex, 0), diagnosisReviewItems.length - 1)
    : 0;
  const currentDiagnosisReviewItem = diagnosisReviewItems[boundedDiagnosisReviewIndex] || null;
  const currentDiagnosisReviewChoices = Array.isArray(currentDiagnosisReviewItem?.choices)
    ? currentDiagnosisReviewItem.choices
    : [];
  const currentDiagnosisReviewExplanation = getDiagnosisReviewExplanation(currentDiagnosisReviewItem);
  const hasPreviousDiagnosisReview = boundedDiagnosisReviewIndex > 0;
  const hasNextDiagnosisReview = boundedDiagnosisReviewIndex < diagnosisReviewItems.length - 1;

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
                <div style={{ width: `${progressPercent}%` }} />
              </div>
              <strong>{progressPercent}%</strong>
            </div>
          </section>

          <div className="diagnosis-flow-panels">
            <section className="diagnosis-flow-question-card">
              <div className="diagnosis-flow-question-subject">
                <span>🎯 {projectData.title}</span>
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
                      disabled={isQuestionTransitionLoading}
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
                    disabled={isQuestionTransitionLoading}
                  />
                </div>
              )}

              {isQuestionTransitionLoading ? <LoadingThreeDotsOverlay /> : null}
              <div className="diagnosis-flow-actions">
                <button
                  type="button"
                  className="diagnosis-flow-action diagnosis-flow-action-secondary"
                  onClick={() => handleAdvance(currentQuestion.type === "short-answer" ? "잘 모르겠어요." : unknownChoiceId)}
                  disabled={isQuestionTransitionLoading}
                >
                  잘 모르겠어요
                </button>
                <button
                  type="button"
                  className="diagnosis-flow-action diagnosis-flow-action-primary"
                  onClick={() => handleAdvance()}
                  disabled={!isCurrentAnswerReady || isQuestionTransitionLoading}
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
                className="diagnosis-flow-start-button diagnosis-flow-start-button-secondary"
                onClick={handleViewReview}
                disabled={isDiagnosisReviewLoading}
              >
                {isDiagnosisReviewLoading ? "불러오는 중" : "풀이보기"} <span>→</span>
              </button>
              <button
                type="button"
                className="diagnosis-flow-start-button diagnosis-flow-start-button-primary"
                onClick={handleStartLearning}
              >
                학습하기 <span>→</span>
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {step === "review" ? (
        <section className="diagnosis-flow-review">
          <header className="diagnosis-flow-page-header">
            <div className="diagnosis-flow-brand">
              <EeumMark />
              <strong>이음</strong>
              <span>/</span>
              <b>수준 진단 풀이</b>
            </div>
          </header>

          <div className="diagnosis-flow-review-wrap">
            <div className="diagnosis-flow-review-header">
              <div>
                <span>진단 결과</span>
                <h1>풀이를 확인해보세요</h1>
                <p>
                  {diagnosisReviewItems.length
                    ? `${boundedDiagnosisReviewIndex + 1} / ${diagnosisReviewItems.length}`
                    : "내가 고른 답과 정답을 문제별로 비교할 수 있어요."}
                </p>
              </div>
              <div className="diagnosis-flow-review-actions">
                <button
                  type="button"
                  className="diagnosis-flow-start-button diagnosis-flow-start-button-primary"
                  onClick={handleStartLearning}
                >
                  학습하기 <span>→</span>
                </button>
              </div>
            </div>

            {diagnosisReviewError ? <p className="diagnosis-flow-error">{diagnosisReviewError}</p> : null}

            {isDiagnosisReviewLoading ? (
              <div className="diagnosis-flow-review-empty">
                <LoadingThreeDotsJumping />
              </div>
            ) : null}

            {!isDiagnosisReviewLoading && !diagnosisReviewError && diagnosisReviewItems.length === 0 ? (
              <p className="diagnosis-flow-review-empty">풀이 내역이 없습니다.</p>
            ) : null}

            {!isDiagnosisReviewLoading && currentDiagnosisReviewItem ? (
              <>
                <article
                  key={currentDiagnosisReviewItem.question_id || boundedDiagnosisReviewIndex}
                  className="diagnosis-flow-review-card"
                >
                  <div className="diagnosis-flow-review-question-head">
                    <span>문제 {boundedDiagnosisReviewIndex + 1}</span>
                    <b
                      className={`diagnosis-flow-review-verdict ${
                        currentDiagnosisReviewItem.is_fully_correct
                          ? "diagnosis-flow-review-verdict-correct"
                          : "diagnosis-flow-review-verdict-wrong"
                      }`}
                    >
                      {currentDiagnosisReviewItem.is_fully_correct ? "정답" : "오답"}
                    </b>
                  </div>
                  <h2>{currentDiagnosisReviewItem.question}</h2>

                  <div className="diagnosis-flow-review-choices">
                    {currentDiagnosisReviewChoices.map((choice, choiceIndex) => {
                      const isSelected = Boolean(choice.is_selected);
                      const isAnswer = Boolean(choice.is_correct);
                      const choiceClassName = [
                        "diagnosis-flow-review-choice",
                        isAnswer ? "diagnosis-flow-review-choice-correct" : "",
                        isSelected && !isAnswer ? "diagnosis-flow-review-choice-wrong" : "",
                      ]
                        .filter(Boolean)
                        .join(" ");

                      return (
                        <div key={choice.option_id || choiceIndex} className={choiceClassName}>
                          <span className="diagnosis-flow-review-choice-index">{choiceIndex + 1}</span>
                          <span className="diagnosis-flow-review-choice-text">{choice.text}</span>
                          <span className="diagnosis-flow-review-choice-tags">
                            {isAnswer ? <b className="diagnosis-flow-review-tag-correct">정답</b> : null}
                            {isSelected ? <b className="diagnosis-flow-review-tag-selected">내 선택</b> : null}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="diagnosis-flow-review-explanation">
                    <h3>해설</h3>
                    {currentDiagnosisReviewExplanation ? (
                      <MarkdownContent content={currentDiagnosisReviewExplanation} />
                    ) : (
                      <p>아직 해설이 준비되지 않았어요.</p>
                    )}
                  </div>
                </article>

                <div className="diagnosis-flow-review-pagination">
                  <button
                    type="button"
                    className="diagnosis-flow-review-page-button"
                    onClick={() => setDiagnosisReviewIndex((current) => Math.max(0, current - 1))}
                    disabled={!hasPreviousDiagnosisReview}
                  >
                    이전 문제
                  </button>
                  <span>
                    {boundedDiagnosisReviewIndex + 1} / {diagnosisReviewItems.length}
                  </span>
                  <span className="diagnosis-flow-review-page-slot">
                    {hasNextDiagnosisReview ? (
                      <button
                        type="button"
                        className="diagnosis-flow-review-page-button diagnosis-flow-review-page-button-primary"
                        onClick={() =>
                          setDiagnosisReviewIndex((current) => Math.min(diagnosisReviewItems.length - 1, current + 1))
                        }
                      >
                        다음 문제
                      </button>
                    ) : null}
                  </span>
                </div>
              </>
            ) : null}
          </div>
        </section>
      ) : null}
    </main>
  );
}
